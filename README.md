# Galata Rotary Bülten Stüdyosu & 2026–2027 Dergi Bültenleri

![Rotary International](https://img.shields.io/badge/Rotary_International-2420._B%C3%B6lge-005DAA?style=for-the-badge&logo=rotary)
![Tema](https://img.shields.io/badge/2026--2027_Tema-KALICI_ETK%C4%B0_YARAT-F7A81B?style=for-the-badge)
![Status](https://img.shields.io/badge/E2E_Tests-35%2F35_PASS-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**Galata Rotary Kulübü** (UR 2420. Bölge, Kulüp No: 64336) için geliştirilmiş modern, web tabanlı bülten düzenleme ve dergi kalitesinde A4 PDF üretim stüdyosu.

---

## 🌐 Canlı Yayın ve Bağlantılar

- **Canlı Web Uygulaması (GitHub Pages)**: [https://rifat-akin.github.io/galata-rotary-bulten/](https://rifat-akin.github.io/galata-rotary-bulten/)
- **Kaynak Kod Deposu**: [https://github.com/Rifat-Akin/galata-rotary-bulten](https://github.com/Rifat-Akin/galata-rotary-bulten)
- **Resmî Kulüp Instagram**: [@galatarotarykulubu](https://www.instagram.com/galatarotarykulubu)

---

## 🏛️ Kurumsal Kimlik & Künye (2026–2027)

- **Dönem Teması**: **KALICI ETKİ YARAT** *(Rotary International 2026–2027 resmî dönem temasıdır)*
- **Rotary International Başkanı**: Olayinka Hakeem Babalola
- **2420. Bölge Guvernörü**: Erden Gökmen
- **Bölge Guvernör Yardımcısı**: İhsan Ercan
- **Kulüp Başkanı**: Sevilay Aksel
- **Kulüp Sekreteri**: Gökhan Alpertunga
- **Kulüp Saymanı**: Burhan Tokgöz
- **Bülten Komitesi**: Rifat Akın Kaplan, Özgür Kuddar, GDB Polat Özcan
- **Kulüp Kuruluş / Charter**: 02.09.2003 / 27.01.2004
- **Olağan Toplantılar**: Her Pazartesi 19:30 | Grand Hyatt İstanbul Taksim & Zoom Hibrit

---

## 📚 2026–2027 Dönemi 4 Aylık Dergi Bültenleri (`output/`)

Tüm bültenler 7–9 sayfa A4 formatında, 300 DPI baskı kalitesinde, vektörel tipografi, çift sütun editoryal mizanpaj, Bento fotoğraf ızgaraları, Galata silüeti ve tam sayfa crimson (`#E01E26`) **"ÇOCUK FELCİNE SON"** arka kapağıyla üretilmiştir.

| Sayı | Dönem Ayı | Tematik Odak | Sayfa Sayısı | PDF Çıktısı |
|:---:|:---:|:---|:---:|:---|
| **Sayı 1** | **Temmuz 2026** | Anne ve Çocuk Sağlığı Ayı • Meeting 1008 • Çekya Değişimi • Sıla Projesi • İlhan Eksen Kitabı | 8 Sayfa A4 | [`output/Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf`](output/Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf) |
| **Sayı 2** | **Ağustos 2026** | Üyelik ve Yeni Kulüp Geliştirme Ayı • Grand Hyatt Taşınma • Gaye Binark • Sağlık Bağışı • 30 Ağustos • Pera Kitabı | 8 Sayfa A4 | [`output/Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf`](output/Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf) |
| **Sayı 3** *(Öncelik 1)* | **Eylül 2026** | Temel Eğitim ve Okuryazarlık Ayı • Ritz Açık Hava Sineması • Pınar Pirim • CP Puset • 23. Yıldönümü • Timurtaş Onan Kitabı | 9 Sayfa A4 | [`output/Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf`](output/Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf) |
| **Sayı 4** *(Öncelik 1)* | **Ekim 2026** | Ekonomik ve Toplumsal Kalkınma & Polio • Cumhuriyet Balosu • RYLA • Akülü Sandalye • Sibel Usanma • Celali Yılmaz Kitabı | 9 Sayfa A4 | [`output/Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf`](output/Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf) |

---

## ✨ Bülten Stüdyosu Temel Özellikleri

1. **İki Panelli İnteraktif Stüdyo & Okuyucu Modu (Split-Screen Studio & Reader Mode)**:
   - Sol panel: Kapak, künye, başkan mesajı, haber/toplantı içerikleri, fotoğraf yükleme, Bento mizanpaj seçici ve kültür köşesi formları (tahribatsız odak/kaydırma koruma ile).
   - Sağ panel & Tam Ekran Okuyucu Modu: Birebir A4 (`210mm × 297mm`) ölçekli canlı önizleme, klavye kısayolları (`←`/`→`, `PageUp`/`PageDown`), `Ctrl + Fare Tekerleği` ile akıcı yakınlaştırma (`%40`–`%200`), küçük sayfa şeridi ve mobil/tablet sekme görünümü.
2. **Çift Çalışma Modu (Dual Runtime: Yerel REST API + GitHub Pages Statik Mod)**:
   - Yerel sunucuda (`http://localhost:3420`) tam REST API kayıt, fotoğraf yükleme ve tek tıkla Headless Chrome PDF derleme.
   - GitHub Pages canlı statik ortamda `data/issues/index.json` kataloğu, `localStorage` taslak koruma, JSON dışa aktarma ve hazır PDF indirme desteği.
3. **Gerçek Zamanlı 297mm A4 Taşma Tespiti (Multi-Page Overflow Detection)**:
   - Metin veya asenkron yüklenen fotoğraflar 297mm A4 sınırını (`.page-inner` dahil) aştığında anında uyarır ve taşan sayfalar arasında ardışık geçiş sağlar.
4. **Dinamik Bento Fotoğraf Izgaraları**:
   - Her haber kartı için tek tıkla 1, 2, 3 veya 4 fotoğraflı Bento mizanpajları (`single-col`, `two-col`, `bento-3`, `bento-4`).
5. **Bağımsız Mizanpaj Motoru (`public/renderer.js`)**:
   - Sıfır harici kütüphane bağımlılığına sahip saf JavaScript DOM motoru; **RotaClub** portalına doğrudan entegre edilebilir.
6. **Yerel Headless Chrome PDF Üretim Motoru (`scripts/export-pdf.mjs`)**:
   - Sistemde kurulu Google Chrome / Edge tarayıcısını izole ve otomatik temizlenen geçici profil ile çalıştırarak harici paket yüklemeden 300 DPI vektörel PDF üretir.
7. **12 Aylık Rotary Takvimi & Tam Sayfa Polio Arka Kapağı**:
   - Sayfa 2'de aktif ayı altın sarısı (`#F7A81B`) ile vurgulayan takvim; arka kapakta kırmızı (`#E01E26`) **"ÇOCUK FELCİNE SON" / "End Polio Now"** kurumsal kapanışı.

---

## 🚀 Hızlı Başlangıç (Yerel Çalıştırma)

### Gereksinimler
- **Node.js**: v20+ (Tavsiye edilen: v24+)
- **Google Chrome** veya **Microsoft Edge** (PDF motoru için)

### 1. Tek Tıkla Başlatma (Windows)
Proje kök dizinindeki `baslat.bat` dosyasına çift tıklayarak yerel sunucuyu başlatabilir ve tarayıcıyı otomatik açabilirsiniz:
```cmd
baslat.bat
```

### 2. Komut Satırı ile Başlatma
```bash
# Bağımlılık gerektirmez (Node.js dahili modülleri kullanılır)
npm start
```
Tarayıcınızda açın: **[http://localhost:3420](http://localhost:3420)**

### 3. Otomatik Doğrulama ve E2E Testlerini Çalıştırma
```bash
# Bülten JSON şeması, tema kuralları ve Türkçe karakter testi
npm test

# 35 senaryolu 4 katmanlı kapsamlı E2E test paketi
node tests/e2e-harness.mjs
```

### 4. PDF Bültenlerini Yeniden Üretme
```bash
# Tüm 4 ayı toplu olarak derleyip output/ klasörüne aktarır
npm run export-pdf

# veya belirli bir ayı üretmek için:
node scripts/export-pdf.mjs --issue 2026-09-eylul
```

---

## 📁 Proje Dizin Yapısı

```
galata-rotary-bulten/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages CI/CD dağıtım hattı
├── data/
│   └── issues/                     # 4 aylık bülten JSON veri modelleri
│       ├── 2026-07-temmuz.json     # Sayı 1
│       ├── 2026-08-agustos.json    # Sayı 2
│       ├── 2026-09-eylul.json      # Sayı 3 (Öncelik 1)
│       └── 2026-10-ekim.json       # Sayı 4 (Öncelik 1)
├── public/
│   ├── index.html                  # Stüdyo web uygulaması arayüzü
│   ├── studio.js                   # İki panelli düzenleyici kontrolcüsü
│   ├── renderer.js                 # Bağımsız A4 mizanpaj motoru (JSON -> DOM)
│   ├── styles/
│   │   ├── studio.css              # Stüdyo kullanıcı arayüzü stilleri
│   │   └── bulletin-print.css      # A4 baskı stilleri ve Bento ızgara kuralları
│   └── assets/
│       ├── brand/                  # Resmî logolar, Rotary amblemi, Galata silüeti
│       └── photos/                 # Ay bazında arşivden seçilmiş yüksek çözünürlüklü fotoğraflar
│           ├── 2026-07/
│           ├── 2026-08/
│           ├── 2026-09/
│           └── 2026-10/
├── output/                         # 300 DPI baskı kalitesinde 4 dergi PDF dosyası
│   ├── Galata_Rotary_Bulten_2026_07_Temmuz_Sayi_1.pdf
│   ├── Galata_Rotary_Bulten_2026_08_Agustos_Sayi_2.pdf
│   ├── Galata_Rotary_Bulten_2026_09_Eylul_Sayi_3.pdf
│   └── Galata_Rotary_Bulten_2026_10_Ekim_Sayi_4.pdf
├── scripts/
│   ├── export-pdf.mjs              # Headless Chrome PDF üretim betiği
│   ├── validate-issues.mjs         # Kurumsal tema ve Türkçe karakter doğrulayıcı
│   └── extract-curated-photos.py   # WhatsApp arşivinden seçici fotoğraf çıkarıcı
├── tests/
│   ├── e2e-harness.mjs             # E2E test çalıştırıcı motoru
│   ├── test-suites.mjs             # Test agregatörü
│   ├── tier1-features.mjs          # 21 izole özellik testi
│   ├── tier2-boundary.mjs          # Sınır değer ve güvenlik testleri
│   ├── tier3-combinations.mjs      # Bento ve takvim kombinasyon testleri
│   ├── tier4-scenarios.mjs         # PDF doğrulamaları ve gerçek senaryolar
│   └── fixtures/                   # Test girdi modelleri
├── server.mjs                      # Hafif Node.js REST API sunucusu
├── baslat.bat                      # Windows hızlı başlatıcı
├── package.json                    # Proje manifestosu
├── .gitignore                      # Git yoksayma kuralları
└── README.md                       # Bu dokümantasyon
```

---

## 🔌 RotaClub Entegrasyon Mimarisi

Bülten Stüdyosu, Türkiye'deki Rotary kulüplerinin yönetim portalı olan **RotaClub** ile tam uyumlu REST API uç noktaları sunar:

- `GET /api/issues`: Kayıtlı tüm bültenlerin özet listesini döner.
- `GET /api/issues/:id`: İlgili ayın tam `BulletinIssue` JSON modelini döner.
- `PUT /api/issues/:id`: Canlı güncellemeleri diske kaydeder.
- `POST /api/upload`: Çok parçalı (multipart) görsel yüklemelerini karşılar.
- `POST /api/export-pdf/:id`: Belirtilen sayı için sunucu tarafında PDF üretimini tetikler.
- `POST /api/rotaclub/sync`: RotaClub üye ve toplantı verilerini bülten şablonuna bağlar.

---

## ⚙️ CI/CD Dağıtım Hattı (GitHub Actions)

Projede `main` dalına yapılan her gönderimde `.github/workflows/deploy.yml` tetiklenir:
1. Kaynak kod çekilir ve Node.js 24 çalışma ortamı kurulur.
2. `node scripts/validate-issues.mjs` ile bülten içerikleri, tema tutarlılığı ("KALICI ETKİ YARAT") ve Türkçe glifler doğrulanır.
3. `node tests/e2e-harness.mjs` ile 35 testin tamamı doğrulanır.
4. `public/`, `data/` ve önceden üretilmiş 4 PDF bülteni barındıran `output/` dizinleri GitHub Pages yapay nesnesine aktarılır.
5. `actions/deploy-pages@v4` ile canlı ortama sıfır kesintiyle dağıtılır.

---

## 📄 Lisans

Bu proje Galata Rotary Kulübü için geliştirilmiş olup MIT Lisansı ile korunmaktadır.  
Kurumsal Rotary logoları ve markaları Rotary International'a aittir.
