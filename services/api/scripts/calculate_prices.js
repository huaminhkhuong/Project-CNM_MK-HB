function mapCategory(catInput) {
  if (typeof catInput === 'number') return catInput;
  const s = String(catInput || '').toLowerCase().trim();
  if (!isNaN(Number(s)) && s !== '') return Number(s);
  if (s === 'cpu') return 1;
  if (s === 'mainboard' || s === 'motherboard') return 2;
  if (s === 'ram') return 3;
  if (s === 'gpu' || s === 'vga') return 4;
  if (s === 'ssd' || s === 'storage') return 5;
  if (s === 'psu' || s === 'power') return 6;
  if (s === 'case') return 7;
  if (s === 'cooling' || s === 'cooler') return 8;
  if (s === 'hdd') return 9;
  if (s === 'monitor') return 10;
  if (s === 'keyboard_mouse' || s === 'gear') return 11;
  if (s === 'headphone') return 12;
  return 0;
}

function calculateRealisticMarketPrice(catInput, name, currentPrice) {
  const n = String(name || '').toLowerCase();
  const cat = mapCategory(catInput);
  let p = Number(currentPrice || 0);

  // 1. CPU (cat 1)
  if (cat === 1) {
    if (n.includes('threadripper') || n.includes('epyc') || n.includes('xeon')) return 55000000;
    if (n.includes('285k') || n.includes('14900') || n.includes('13900') || n.includes('7950x') || n.includes('9950x')) return 14500000;
    if (n.includes('9850x3d') || n.includes('9800x3d')) return 12500000;
    if (n.includes('270k') || n.includes('265k') || n.includes('14700') || n.includes('13700') || n.includes('7800x3d') || n.includes('7900')) return 9890000;
    if (n.includes('12900k') || n.includes('9700x')) return 8490000;
    if (n.includes('250k') || n.includes('245k')) {
      if (n.includes('250kf')) return 6890000;
      return 7290000;
    }
    if (n.includes('14600') || n.includes('13600') || n.includes('7700x') || n.includes('7700') || n.includes('9600x') || n.includes('12700')) return 6890000;
    if (n.includes('225f') || n.includes('225')) return 5290000;
    if (n.includes('12600k') || n.includes('14500') || n.includes('13500') || n.includes('14400') || n.includes('7600x') || n.includes('7600')) return 4890000;
    if (n.includes('8400f') || n.includes('7500f') || n.includes('8500g') || n.includes('13400')) return 3890000;
    if (n.includes('12400') || n.includes('5700') || n.includes('5600x') || n.includes('5600') || n.includes('5500gt')) return 2890000;
    if (n.includes('3400g')) return 2490000;
    if (n.includes('14100') || n.includes('13100') || n.includes('12100') || n.includes('4600g') || n.includes('5500') || n.includes('3600')) return 2190000;
    if (n.includes('3200g')) return 1890000;
    if (p < 1000000 || p > 60000000) return 3500000;
    return p;
  }

  // 2. MAINBOARD (cat 2)
  if (cat === 2) {
    if (n.includes('x870e') || n.includes('crosshair') || n.includes('godlike')) return 11900000;
    if (n.includes('z890') || n.includes('x870')) return 8890000;
    if (n.includes('z790') || n.includes('x670e')) return 6890000;
    if (n.includes('x670') || n.includes('b650e') || n.includes('z690')) return 5490000;
    if (n.includes('b860') || n.includes('b860m')) return 3790000;
    if (n.includes('b760') || n.includes('b650')) return 3490000;
    if (n.includes('b550') || n.includes('b450')) return 2290000;
    if (n.includes('h610') || n.includes('a620') || n.includes('a520')) return 1850000;
    if (p < 1200000 || p > 30000000) return 3290000;
    return p;
  }

  // 3. RAM (cat 3)
  if (cat === 3) {
    const isDdr5 = n.includes('ddr5') || n.includes('5600') || n.includes('6000') || n.includes('6400') || n.includes('6600');
    if (n.includes('96gb') || n.includes('2x48')) return 10900000;
    if (n.includes('64gb') || n.includes('2x32') || n.includes('32gbx2')) return isDdr5 ? 4990000 : 3490000;
    if (n.includes('32gb') || n.includes('2x16') || n.includes('16gbx2')) return isDdr5 ? 2690000 : 1790000;
    if (n.includes('16gb') || n.includes('2x8') || n.includes('8gbx2')) return isDdr5 ? 1390000 : 850000;
    if (n.includes('8gb') || n.includes('1x8') || n.includes('1x 8gb')) return isDdr5 ? 850000 : 450000;
    if (p < 300000 || p > 15000000) return isDdr5 ? 1390000 : 850000;
    return p;
  }

  // 4. GPU (cat 4)
  if (cat === 4) {
    // Workstation & Professional
    if (n.includes('a5500')) return 62000000;
    if (n.includes('a5000')) return 44700000;
    if (n.includes('2000 ada')) return 16500000;
    if (n.includes('a1000')) return 8500000;
    if (n.includes('t1000')) return 6890000;
    if (n.includes('a400')) return 5990000;
    if (n.includes('t400')) return 3290000;
    if (/\ba40\b/i.test(n) || n.includes('a100 80gb') || n.includes('a100-') || n.includes('h100') || n.includes('h200') || n.includes('l40')) return 115000000;

    // AMD RX 9000 Series
    if (n.includes('9070 xt') || n.includes('9070xt')) return 18900000;
    if (n.includes('9070')) return 16500000;
    if (n.includes('9060 xt') || n.includes('9060xt')) return 8900000;

    // Consumer Gaming GPUs
    if (n.includes('5090') || n.includes('4090')) return 54900000;
    if (n.includes('5080') || n.includes('4080 super') || n.includes('4080')) return 31900000;
    if (n.includes('5070 ti') || n.includes('4070 ti super') || n.includes('4070 ti') || n.includes('7900 xt')) return 22900000;
    if (n.includes('5070') || n.includes('4070 super') || n.includes('4070') || n.includes('7800 xt')) return 16900000;
    if (n.includes('4060 ti') || n.includes('5060 ti') || n.includes('7700 xt')) return 10890000;
    if (n.includes('5060') || n.includes('4060') || n.includes('7600 xt') || n.includes('3060 ti')) return 7990000;
    if (n.includes('3060')) return 6890000;
    if (n.includes('3050') || n.includes('5050') || n.includes('6600') || n.includes('a580')) return 4990000;
    if (n.includes('6500') || n.includes('1650') || n.includes('a380')) return 3490000;
    if (n.includes('1030') || n.includes('730') || n.includes('r7 240')) return 1490000;

    if (p < 2000000 || p > 90000000) return 7500000;
    return p;
  }

  // 5. SSD (cat 5)
  if (cat === 5) {
    const isGen4 = n.includes('gen4') || n.includes('gen 4') || n.includes('pcie 4') || n.includes('sn850') || n.includes('990 pro');
    if (n.includes('4tb') || n.includes('4000g')) return 7500000;
    if (n.includes('2tb') || n.includes('2000g')) return isGen4 ? 3890000 : 3290000;
    if (n.includes('1tb') || n.includes('1000g') || n.includes('960gb')) return isGen4 ? 1890000 : 1550000;
    if (n.includes('500g') || n.includes('512g') || n.includes('480g')) return isGen4 ? 1090000 : 850000;
    if (n.includes('250g') || n.includes('256g') || n.includes('240g')) return 590000;
    if (n.includes('120g') || n.includes('128g')) return 390000;
    if (p === 30000000 || p < 300000 || p > 15000000) return 1290000;
    return p;
  }

  // 9. HDD (cat 9)
  if (cat === 9) {
    if (n.includes('18tb')) return 11290000;
    if (n.includes('16tb')) return 9490000;
    if (n.includes('14tb')) return 7990000;
    if (n.includes('12tb')) return 6890000;
    if (n.includes('10tb')) return 5890000;
    if (n.includes('8tb')) return 3990000;
    if (n.includes('6tb')) return 3190000;
    if (n.includes('4tb')) return 2290000;
    if (n.includes('2tb')) return 1450000;
    if (n.includes('1tb')) return 1050000;
    if (p < 500000 || p > 20000000) return 1450000;
    return p;
  }

  // 11. KEYBOARD / MOUSE (cat 11)
  if (cat === 11) {
    if (n.includes('g502x')) return 1390000;
    if (n.includes('g502')) return 950000;
    if (n.includes('superlight') || n.includes('pro x')) return 2690000;
    if (p < 100000 || p > 10000000) return 590000;
    return p;
  }

  // 12. HEADPHONE (cat 12)
  if (cat === 12) {
    if (n.includes('pro x 2')) return 4890000;
    if (n.includes('pro x se')) return 1490000;
    if (n.includes('pro x')) return 2490000;
    if (n.includes('cetra')) return 990000;
    if (n.includes('wireless') || n.includes('bluetooth') || n.includes('anc') || n.includes('sony') || n.includes('sennheiser')) return 3290000;
    if (p < 100000 || p > 15000000) return 890000;
    return p;
  }

  return p;
}

module.exports = { calculateRealisticMarketPrice, mapCategory };
