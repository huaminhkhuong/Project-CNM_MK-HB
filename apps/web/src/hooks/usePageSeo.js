import { useEffect } from "react";

/**
 * usePageSeo — Dynamic Document Title & OpenGraph Meta Tags Manager
 * Updates head meta tags dynamically for SEO and Social Media link previews (Facebook, Zalo, Discord, Twitter).
 * 
 * @param {Object} options
 * @param {string} options.title - Page title (will append ' | PC Mall' if not already present)
 * @param {string} [options.description] - Page meta description
 * @param {string} [options.image] - OpenGraph preview image URL
 * @param {string} [options.url] - Canonical/OpenGraph URL
 * @param {string} [options.type] - OpenGraph type ('website' | 'product' | 'article')
 */
export function usePageSeo({
  title,
  description,
  image = "/assets/ai_bot_mascot_3d.png",
  url,
  type = "website"
} = {}) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      const fullTitle = title.includes("PC Mall") ? title : `${title} | PC Mall`;
      document.title = fullTitle;
      updateMeta("property", "og:title", fullTitle);
      updateMeta("name", "twitter:title", fullTitle);
    }

    // 2. Update Description
    if (description) {
      updateMeta("name", "description", description);
      updateMeta("property", "og:description", description);
      updateMeta("name", "twitter:description", description);
    }

    // 3. Update Image
    if (image) {
      const resolvedImage = image.startsWith("http") ? image : `${window.location.origin}${image.startsWith("/") ? "" : "/"}${image}`;
      updateMeta("property", "og:image", resolvedImage);
      updateMeta("name", "twitter:image", resolvedImage);
    }

    // 4. Update URL & Type
    const currentUrl = url || window.location.href;
    updateMeta("property", "og:url", currentUrl);
    updateMeta("property", "og:type", type);
  }, [title, description, image, url, type]);
}

function updateMeta(attrName, attrValue, content) {
  if (!content) return;
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default usePageSeo;

