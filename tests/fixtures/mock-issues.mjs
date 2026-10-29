/**
 * Test Fixtures for E2E Test Suite
 * Includes valid reference models, boundary cases, and adversarial poison fixtures.
 */

export const CORPORATE_THEME = "KALICI ETKİ YARAT";
export const FORBIDDEN_THEME = "Rotary Sihri";
export const POLIO_CRIMSON = "#E01E26";
export const ROTARY_GOLD = "#F7A81B";
export const PAPER_IVORY = "#FAF8F3";

export const ALL_TURKISH_GLYPHS = "ğüşıİöçĞÜŞIÖÇ";
export const SAMPLE_TURKISH_TEXT = "Galata Rotary Kulübü Çağdaş Eğitim ve Sağlık Projeleri: Çeltik, Işık, Şiir, Öğrenci, Güven, İş";

export const EXPECTED_BOOKS = {
  "2026-07-temmuz": {
    author: "İlhan Eksen",
    titleContains: "Galata Köprüsü"
  },
  "2026-08-agustos": {
    authorContains: "Pera",
    titleContains: "Hatırat"
  },
  "2026-09-eylul": {
    author: "Timurtaş Onan",
    titleContains: "Beyoğlu: Eski Yeni"
  },
  "2026-10-ekim": {
    author: "Celali Yılmaz",
    titleContains: "Galata Hanları"
  }
};

export const EXPECTED_OFFICERS = {
  riPresident: "Olayinka Hakeem Babalola",
  districtGovernor: "Erden Gökmen",
  president: "Sevilay Aksel",
  secretary: "Gökhan Alpertunga",
  treasurer: "Burhan Tokgöz"
};

export const VALID_SEPTEMBER_MOCK = {
  id: "2026-09-eylul",
  issueNumber: 3,
  rotaryYear: "2026-2027",
  month: "Eylül",
  year: 2026,
  theme: "KALICI ETKİ YARAT",
  rotaryMonthTheme: "Temel Eğitim ve Okuryazarlık Ayı",
  club: {
    name: "Galata Rotary Kulübü",
    district: "UR 2420. Bölge",
    clubNo: "64336",
    charterDate: "27.01.2004",
    foundationDate: "02.09.2003",
    meeting: "Her Pazartesi 19:30 | Grand Hyatt İstanbul Taksim & Zoom"
  },
  officers: {
    riPresident: "Olayinka Hakeem Babalola",
    districtGovernor: "Erden Gökmen",
    assistantGovernor: "İhsan Ercan",
    president: "Sevilay Aksel",
    secretary: "Gökhan Alpertunga",
    treasurer: "Burhan Tokgöz",
    bulletinCommittee: ["Rifat Akın Kaplan", "Özgür Kuddar", "GDB Polat Özcan"]
  },
  presidentMessage: {
    title: "Eğitimle Büyüyen Umut, Barışla Güçlenen Gelecek",
    body: "Sevgili Galata Rotary Ailemiz, 2026–2027 dönemine 'Kalıcı Etki Yarat' vizyonuyla başladık. 21 Eylül Dünya Barış Günü ve 23 Eylül kulübümüzün 23. kuruluş yıldönümü onuruyla hizmetlerimizi sürdürüyoruz.",
    photo: "assets/photos/2026-09/baskan_sevilay_aksel.jpg"
  },
  articles: [
    {
      id: "art-01",
      category: "Galata Sosyal",
      date: "1 Eylül 2026",
      title: "Ritz-Carlton Açıkhava Sineması Dostluk Buluşması",
      venue: "The Ritz-Carlton Açık Hava Terası",
      summary: "Kulüp üyelerimizin katılımıyla gerçekleştirilen açık hava sineması etkinliğimizde dostluklarımızı pekiştirirken burs fonumuza 5.000 TL katkı sağladık.",
      layout: "two-col",
      photos: [
        { url: "assets/photos/2026-09/00003001.jpg", caption: "Galata Rotary Ailesi Açık Hava Sinemasında" },
        { url: "assets/photos/2026-09/00003005.jpg", caption: "Dostluk Sohbetleri" }
      ]
    },
    {
      id: "art-02",
      category: "Engelsiz Galata",
      date: "28 Eylül 2026",
      title: "Serebral Palsili Evladımıza Özel Engelli Puseti Teslimi",
      venue: "Beyoğlu Belediyesi Sağlık İşleri Müdürlüğü",
      summary: "Beyoğlu Belediyesi iş birliğiyle Serebral Palsili ihtiyaç sahibi çocuğumuza özel puset teslim edildi. 29.500 TL bağış ile hayatlara kalıcı dokunuş gerçekleştirdik.",
      layout: "single-col",
      photos: [
        { url: "assets/photos/2026-09/00005382.jpg", caption: "Özel Puset Teslim Anı" }
      ]
    }
  ],
  culture: {
    title: "Galata Kültür Köşesi",
    book: {
      title: "Beyoğlu: Eski Yeni (Then & Now)",
      author: "Timurtaş Onan",
      cover: "assets/photos/2026-09/kitap_beyoglu_eski_yeni.jpg",
      summary: "Timurtaş Onan'ın objektifinden Beyoğlu'nun dünü ve bugünü arasındaki mimari ve sosyolojik yolculuk."
    }
  },
  backCover: {
    theme: "ÇOCUK FELCİNE SON",
    subTheme: "End Polio Now",
    color: "#E01E26",
    contact: {
      instagram: "@galatarotarykulubu",
      web: "www.galatarotary.org"
    }
  }
};

/**
 * Adversarial Poison Model containing forbidden "Rotary Sihri" string
 */
export const POISONED_MAGIC_MOCK = {
  ...VALID_SEPTEMBER_MOCK,
  theme: "Rotary Sihri",
  presidentMessage: {
    ...VALID_SEPTEMBER_MOCK.presidentMessage,
    body: "Bu yıl Rotary Sihri ile dünyayı birleştireceğiz..."
  }
};

/**
 * Extreme boundary test model with Turkish glyphs, extreme lengths, and edge layouts
 */
export const EXTREME_BOUNDARY_MOCK = {
  ...VALID_SEPTEMBER_MOCK,
  club: {
    ...VALID_SEPTEMBER_MOCK.club,
    name: "Galata Rotary Kulübü - Türkçe Karakter Denetimi (ğüşıİöç ĞÜŞIÖÇ)"
  },
  articles: [
    {
      id: "boundary-art-empty",
      category: "Boş Özet Testi",
      date: "30 Eylül 2026",
      title: "Boş Özet İçeren Etkinlik Başlığı",
      summary: "",
      layout: "single-col",
      photos: []
    },
    {
      id: "boundary-art-huge",
      category: "Aşırı Uzun Metin & Taşıma Testi",
      date: "30 Eylül 2026",
      title: "Çok Uzun Paragraf Testi " + ALL_TURKISH_GLYPHS,
      summary: "A".repeat(2500),
      layout: "bento-4",
      photos: [
        { url: "assets/photos/2026-09/p1.jpg", caption: "Foto 1" },
        { url: "assets/photos/2026-09/p2.jpg", caption: "Foto 2" },
        { url: "assets/photos/2026-09/p3.jpg", caption: "Foto 3" },
        { url: "assets/photos/2026-09/p4.jpg", caption: "Foto 4" }
      ]
    }
  ]
};
