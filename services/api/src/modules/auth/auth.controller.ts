import { Request, Response } from "express";

import { AppError } from "../../errors/app-error";
import { createUser, findUserByEmail, findUserByPhone, findUserById } from "../../repositories/user.repository";
import { hashPassword, verifyPassword } from "../../services/password.service";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../../services/token.service";
import { blacklistToken, isTokenBlacklisted } from "../../services/token-blacklist.service";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/async-handler";
import { loginSchema, refreshSchema, registerSchema } from "./auth.validator";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);

  const existing = await findUserByEmail(payload.email);
  if (existing) {
    throw new AppError("Email already exists", 400);
  }

  if (payload.phone) {
    const existingPhone = await findUserByPhone(payload.phone);
    if (existingPhone) {
      throw new AppError("Số điện thoại đã tồn tại", 400);
    }
  }

  const user = await createUser({
    email: payload.email,
    password: await hashPassword(payload.password),
    fullName: payload.fullName || payload.full_name,
    phone: payload.phone
  });

  if (!user) {
    throw new AppError("Error creating user", 500);
  }

  const tokenPayload = { 
    userId: String(user.id), 
    email: user.email || "", 
    role: (user as any).Role?.name || "USER" 
  };

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email || "",
        fullName: user.full_name,
        phone: user.phone || null,
        role: (user as any).Role?.name || "USER"
      },
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload)
    }
  });
});

export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const existing = await findUserByEmail(email);
  res.status(200).json({
    success: true,
    data: {
      email,
      exists: Boolean(existing)
    }
  });
});

function buildAuthResponse(user: NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>) {
  const tokenPayload = {
    userId: String(user.id),
    email: user.email || "",
    role: (user as { Role?: { name?: string } }).Role?.name || "USER"
  };

  return {
    user: {
      id: user.id,
      email: user.email || "",
      fullName: user.full_name,
      phone: user.phone || null,
      role: tokenPayload.role
    },
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload)
  };
}

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const payload = refreshSchema.parse(req.body);
  const tokenPayload = verifyRefreshToken(payload.refreshToken);

  // Reject if token was explicitly logged out
  const blacklisted = await isTokenBlacklisted(payload.refreshToken);
  if (blacklisted) {
    throw new AppError("Token has been revoked", 401);
  }

  const user = await findUserById(tokenPayload.userId);
  if (!user) {
    throw new AppError("User not found", 401);
  }

  if (String(user.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
    throw new AppError("Account is not active", 403);
  }

  res.status(200).json({
    success: true,
    data: buildAuthResponse(user)
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken || typeof refreshToken !== "string") {
    throw new AppError("refreshToken is required", 400);
  }

  // Blacklist the token — ignores invalid/expired tokens gracefully
  try {
    await blacklistToken(refreshToken);
  } catch {
    // If blacklist fails (e.g. DB issue) we still log out the client
  }

  res.status(200).json({
    success: true,
    data: { loggedOut: true }
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);

  const user = await findUserByEmail(payload.email);
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await verifyPassword(payload.password, user.password || "");
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  res.status(200).json({
    success: true,
    data: buildAuthResponse(user)
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await findUserById(req.user.userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const addresses = await prisma.address.findMany({
    where: { user_id: Number(req.user.userId) },
    orderBy: { created_at: "desc" }
  });

  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      email: user.email || "",
      fullName: user.full_name,
      phone: user.phone,
      role: (user as any).Role?.name || "USER",
      addresses: addresses.map(formatAddress)
    }
  });
});

export const googleMock = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullName } = req.body;
  if (!email) throw new AppError("Email is required", 400);

  let user = await findUserByEmail(email);
  
  if (!user) {
    // Create a new user for this mock google account
    user = await createUser({
      email,
      fullName: fullName || "Google User",
      password: "google-mock-password-" + Math.random().toString(36).slice(-8),
    });
  }

  if (!user) throw new AppError("Error processing google login", 500);

  const tokenPayload = { 
    userId: String(user.id), 
    email: user.email || "", 
    role: (user as any).Role?.name || "USER" 
  };

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email || "",
        fullName: user.full_name,
        phone: user.phone || null,
        role: (user as any).Role?.name || "USER"
      },
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload)
    }
  });
});

export const getMyAddresses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = req.user.userId;

  const addresses = await prisma.address.findMany({
    where: { user_id: Number(userId) },
    orderBy: { created_at: "desc" }
  });

  res.status(200).json({
    success: true,
    data: addresses.map(formatAddress)
  });
});

function formatAddress(address: any) {
  return {
    id: address.id,
    fullName: address.full_name || "",
    phone: address.phone || "",
    addressLine: address.address_line || "",
    ward: address.ward || "",
    district: address.district || "",
    province: address.province || "",
    createdAt: address.created_at || null
  };
}

function parseAddressPayload(body: any) {
  return {
    full_name: body.full_name || body.fullName,
    phone: body.phone,
    address_line: body.address_line || body.addressLine,
    ward: body.ward,
    district: body.district,
    province: body.province
  };
}

export const createMyAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = req.user.userId;
  const { full_name, phone, address_line, ward, district, province } = parseAddressPayload(req.body);

  if (!full_name || !phone || !address_line || !ward || !district || !province) {
     throw new AppError("Vui lòng cung cấp đầy đủ thông tin địa chỉ", 400);
  }

  const newAddress = await prisma.address.create({
    data: {
      user_id: Number(userId),
      full_name,
      phone,
      address_line,
      ward,
      district,
      province
    }
  });

  res.status(201).json({
    success: true,
    data: formatAddress(newAddress)
  });
});

export const updateCurrentProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const fullName = String(req.body.full_name || req.body.fullName || "").trim();
  const phone = String(req.body.phone || "").trim();

  if (!fullName) {
    throw new AppError("Họ và tên là bắt buộc", 400);
  }

  if (phone && !/^(0|\+84)(\d{9,10})$/.test(phone)) {
    throw new AppError("Số điện thoại Việt Nam không hợp lệ", 400);
  }

  const user = await prisma.user.update({
    where: { id: Number(req.user.userId) },
    data: {
      full_name: fullName,
      phone: phone || null,
      updated_at: new Date()
    },
    include: { Role: true, Address: { orderBy: { created_at: "desc" } } }
  });

  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      email: user.email || "",
      fullName: user.full_name,
      phone: user.phone,
      role: user.Role?.name || "USER",
      addresses: user.Address.map(formatAddress)
    }
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const currentPassword = String(req.body.currentPassword || req.body.current_password || "");
  const newPassword = String(req.body.newPassword || req.body.new_password || "");

  if (newPassword.length < 6) {
    throw new AppError("Mật khẩu mới phải có ít nhất 6 ký tự", 400);
  }

  const user = await findUserById(req.user.userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await verifyPassword(currentPassword, user.password || "");
  if (!isMatch) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400);
  }

  await prisma.user.update({
    where: { id: Number(req.user.userId) },
    data: {
      password: await hashPassword(newPassword),
      updated_at: new Date()
    }
  });

  res.status(200).json({
    success: true,
    data: { changed: true }
  });
});

export const updateMyAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const current = await prisma.address.findFirst({
    where: {
      id: Number(req.params.addressId),
      user_id: Number(req.user.userId)
    }
  });

  if (!current) {
    throw new AppError("Address not found", 404);
  }

  const { full_name, phone, address_line, ward, district, province } = parseAddressPayload(req.body);
  if (!full_name || !phone || !address_line || !ward || !district || !province) {
    throw new AppError("Vui lòng cung cấp đầy đủ thông tin địa chỉ", 400);
  }

  const updated = await prisma.address.update({
    where: { id: current.id },
    data: {
      full_name,
      phone,
      address_line,
      ward,
      district,
      province
    }
  });

  res.status(200).json({
    success: true,
    data: formatAddress(updated)
  });
});

export const deleteMyAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const current = await prisma.address.findFirst({
    where: {
      id: Number(req.params.addressId),
      user_id: Number(req.user.userId)
    }
  });

  if (!current) {
    throw new AppError("Address not found", 404);
  }

  await prisma.address.delete({ where: { id: current.id } });

  res.status(200).json({
    success: true,
    data: { deleted: true }
  });
});

