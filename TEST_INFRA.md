# Galata Rotary Bülten Stüdyosu — Test Altyapısı (TEST_INFRA.md)

Bu doküman, Galata Rotary Bülten Stüdyosu projesinin çok katmanlı, ampirik ve çekişmeli (adversarial) test mimarisini, test süitlerinin kapsamını, çalıştırma yöntemlerini ve kalite güvence standartlarını belgeler.

---

## 1. Test Mimarisi Genel Bakış

Galata Rotary Bülten Stüdyosu projesinde kalite güvencesi; statik doğrulama, izole birim testleri, 4 aşamalı uçtan uca (E2E) entegrasyon testleri, gerçek Headless Chrome CDP orakılları ve çekişmeli sınır testlerinden oluşan kapsamlı bir piramit üzerinde inşa edilmiştir.

```
                              ┌───────────────────────────────────┐
                              │     Canlı Headless Chrome CDP     │
                              │ (challenger-m1-2, challenger-m2)  │
                              ├───────────────────────────────────┤
                              │     Çekişmeli Sınır & Güvenlik    │
                              │ (challenger-m1, challenger-m2-1)  │
                              ├───────────────────────────────────┤
                              │    Çift Mod & Arayüz Dayanıklılık │
                              │ (challenger-m1-dual, reviewer-m1) │
                              ├───────────────────────────────────┤
                              │     4 Kademeli E2E Test Koşucu    │
                              │   (e2e-harness: Tier 1, 2, 3, 4)  │
                              ├───────────────────────────────────┤
                              │   Statik Şema & Kurumsal Veto     │
                              │     (scripts/validate-issues)     │
                              └───────────────────────────────────┘
```

---

## 2. Test Süitleri Detaylı Dökümü

### 2.1. Bülten Doğrulayıcı CLI (`scripts/validate-issues.mjs`)
- **Amaç**: `data/issues/*.json` dosyalarının şema bütünlüğünü ve kurumsal standartlarını denetler.
- **Denetimler**:
  - Şema yapısı (zorunlu alanlar: `rotaryYear`, `theme`, `rotaryMonthTheme`, `officers`, `presidentMessage`, `articles`, `culture`, `backCover`).
  - Kurumsal Dönem Teması: Kesinlikle "KALICI ETKİ YARAT" (2026–2027).
  - Veto Kuralı: "Rotary Sihri" ifadesi sıfır toleransla engellenir (Unicode NFKC normalizasyonu, Türkçe büyük/küçük harf duyarsız regex).
  - Türkçe Karakter Bütünlüğü: Sıfır mojibake (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü).
  - Disk Varlık Denetimi: Modelde referans verilen tüm görsellerin diskte fiziken varlığı kontrol edilir.
  - Arka Kapak Standardı: Tam sayfa "ÇOCUK FELCİNE SON" (#E01E26 crimson kırmızısı).

### 2.2. 4 Kademeli E2E Test Koşucu (`tests/e2e-harness.mjs`)
- **Tier 1 (İzole Özellikler - F01–F21)**:
  - `T1-F01` - Tek komutla sunucu ve başlatıcı (`server.mjs`, `package.json`).
  - `T1-F02` - Modüler REST API uç noktaları (`/api/issues`, `/api/upload`, `/api/export-pdf`).
  - `T1-F03` - Bağımsız şablonlayıcı motoru (`public/renderer.js`).
  - `T1-F04` - Bölünmüş ekran stüdyo editörü (`public/index.html`, `public/studio.js`).
  - `T1-F05` - Dinamik Bento fotoğraf ızgara düzenleri (`bulletin-print.css`).
  - `T1-F06` - A4 taşma algılama (297mm sınır kontrolü).
  - `T1-F07` - Yeni ay başlatıcı şablonlayıcı (`createIssue`).
  - `T1-F08` - Headless Chrome PDF üretim motoru (`scripts/export-pdf.mjs`).
  - `T1-F09` - Toplu PDF CLI (`--all` bayrağı desteği).
  - `T1-F10` - Kurumsal tema denetimi.
  - `T1-F11`–`T1-F17` - Sayfa modelleri, kapak, başkan mesajı, 4 aylık veri modelleri (Temmuz, Ağustos, Eylül, Ekim).
  - `T1-F18`–`T1-F21` - WhatsApp ayrıştırıcı, doğrulama süiti, GitHub Pages CI/CD ve disk hijyeni.
- **Tier 2 (Sınır & Uç Durumlar)**:
  - Türkçe UTF-8 glif bütünlüğü, çekişmeli tema vetosu, boş/aşırı metin toleransları, 0–4 fotoğraf sınırları, eksik görsel toleransı, A4 yükseklik eşiği, 7–9 sayfa bütçesi.
- **Tier 3 (Çapraz Özellik Kombinasyonları)**:
  - Bento düzenleri & CSS Grid tutarlılığı, 12 aylık takvim aktif ay vurgulama, canlı önizleme ve baskı CSS 210mm x 297mm paritesi.
- **Tier 4 (Gerçek Dünya Senaryoları)**:
  - PDF üretim boru hattı keşfi, 4 bülten PDF binary başlık denetimi (`%PDF-`), arka kapak renk doğrulaması (#E01E26), kültürel kitap öneri tutarlılığı.

### 2.3. İnceleyici M1-1 Çekişmeli Stres Testi (`tests/reviewer-m1-stress-tests.mjs`)
- **Suite 1**: DOM ID & İşaretleme Sözleşmesi (`public/index.html` ile `public/studio.js` arasındaki tüm `getElementById` eşleşmeleri).
- **Suite 2**: CSS Uygunluğu & Yer Değiştirmeyen Taşma Kuralları (pozisyon: absolute, 0px içerik kayması, `@media print` baskı temizliği, mobil 16px iOS font kuralı).
- **Suite 3**: Çift Mod Mantığı & Göreceli Yol Çözümleme (`resolveAppPath` yerel sunucu ve GitHub Pages alt dizin desteği).
- **Suite 4**: Çekişmeli Tema Veto Regex Testleri (Unicode varyasyonları, boşluklu/boşluksuz saldırılar, meşru cümle izinleri).
- **Suite 5**: HTML Escaping & XSS Sanitizasyonu (`escapeHtml`, `escapeAttr`).
- **Suite 6**: Bütünlük İhlalleri & Hile Denetimi (sahte mock ve boş cephe fonksiyonu bulunmadığı kanıtı).
- **Suite 7**: M1 Geliştirmeleri Doğrulaması (Reader klavye navigasyonu, Ctrl+Wheel zoom, selectIssue reset, multi-page overflow cycling, asenkron görsel overflow re-check, server month resolution, server PDF filename resolution).

### 2.4. Challenger M1 Ampirik Stres Testi (`tests/challenger-m1-empirical-tests.mjs`)
- **Suite 1**: Fotoğraf & Varlık Doğrulaması (JPEG SOI `0xFFD8`, EOI `0xFFD9`, SOF boyut ayrıştırma, sıfır-byte dosya denetimi).
- **Suite 2**: Çekişmeli "Rotary Sihri" Enjeksiyon Orakılı (derin nesne ağacı mutasyonları ve anında veto kanıtı).
- **Suite 3**: Şema İhlali & Sınır Koşulları Orakılı (bozuk JSON, eksik alanlar, yanlış kulüp numarası, geçersiz renkler).
- **Suite 4**: Türkçe Tipografi & Mojibake Reddi (çift kodlanmış UTF-8 bozulmaları).
- **Suite 5**: Temiz Proje Doğrulaması.

### 2.5. Challenger M1-1 Çift Mod & Kalıcılık Stres Testi (`tests/challenger-m1-dual-mode.mjs`)
- **Suite 1**: Çift Modlu İstemci Adaptörü (Yerel REST API ile Statik GitHub Pages çalışma modları, otomatik algılama ve görsel durum rozeti).
- **Suite 2**: Kurumsal Marka Vetosu & `localStorage` Kalıcılığı (engellenen terimlerin tarayıcı hafızasına dahi yazılamaması).
- **Suite 3**: JSON İndirme & Fabrika Ayarlarına Sıfırlama.
- **Suite 4**: Görsel Yükleme & Base64 Data URL Yedeklemesi.
- **Suite 5**: Bülten Okuyucu Modu & A4 Taşma Ölçümü.

### 2.6. Challenger M1-2 Headless Chrome Orakılı (`tests/challenger-m1-2-empirical-tests.mjs`)
- **Suite 1**: Statik Kod & CSS Mimari Doğrulaması.
- **Suite 2**: Canlı Headless Chrome/Edge CDP Otomasyonu:
  - 2A: A4 Taşma Tespiti & Sıfır Yer Değiştirme (yüzen rozet ile 0px içerik kayması kanıtı).
  - 2B: Bülten Okuyucu Modu & Sayfa Atlama Senkronizasyonu (100% genişlik, `#07111E` galeri laciverti, sayfa sayaç senkronizasyonu).
  - 2C: Mobil & Tablet Duyarlı Düzen (<900px tek panel, <640px 16px font boyutu).
  - 2D: Tahribatsız Makale Yönetimi & DOM Sürekliliği (bellek kimliği sentinelleri, 0 `innerHTML` sıfırlaması).

### 2.7. Challenger M2 PDF & Baskı Mimarisi (`tests/challenger-m2-empirical-tests.mjs`)
- **Suite 1**: Üretilen PDF'lerin Derin İkili & Yapısal Denetimi (Temmuz, Ağustos, Eylül, Ekim PDF'leri, 7–9 sayfa bütçesi, dosya boyutu >500 KB, %%EOF işareti).
- **Suite 2**: `scripts/export-pdf.mjs` CLI Dayanıklılık & Çekişmeli Testi (geçersiz parametreler, yol aşma/path traversal denetimleri).
- **Suite 3**: `public/renderer.js` Uç Durum Stres Testi (0 ila 10 fotoğraf, aşırı metin uzunlukları, XSS temizliği).

### 2.8. Challenger M2-1 Güvenlik & Profil Temizliği (`tests/challenger-m2-1-empirical.mjs`)
- **Suite 1**: Türkçe Glif & Kaçışlı Boşluk Regex Veto Stresi (JSON kaçışları `\t`, `\n`, `\r`, Unicode kaçışları `\u0130`).
- **Suite 2**: Yol Aşma (Path Traversal) & Geçici Profil Hijyeni (`%TEMP%/galata-pdf-chrome-*` dizinlerinin sıfır artıkla temizlenmesi).
- **Suite 3**: Mevcut Test Süitlerinin Bütünlük Doğrulaması.

### 2.9. Challenger M2-2 Tipografi & Düzen (`tests/challenger-m2-2-layout-typography.mjs`)
- **Suite 1**: Boyutsal Uygunluk (`bulletin-print.css`, `@page size: 210mm 297mm`, `margin: 0`).
- **Suite 2**: Türkçe Karakter Netliği & Tipografi (antialiased fontlar, PDF ToUnicode CMap glif akışlarının çıkarılması ve 12 Türkçe karakterin ikili eşleme kanıtı).
- **Suite 3**: Takvim Düzeni (12 aylık takvim, aktif ay sarı altın `#F7A81B` vurgusu, tek sayfa sığması).
- **Suite 4**: Arka Kapak Kurumsal Uygunluk ("ÇOCUK FELCİNE SON", `#E01E26`, 4 sayının tamamında tam sayfa arka kapakta bulunma ve iç sayfalarda kesinlikle bulunmama kanıtı).

### 2.10. M1 Fonksiyonel Birim Testi (`tests/m1-functional-unit-tests.mjs`)
- **Suite 1**: `server.mjs createIssue()` fonksiyonunun `MONTH_ORDER` üzerinden `monthNumStr` çözümlemesi ('Ocak' -> '01', 'Kasım' -> '11').
- **Suite 2**: `server.mjs POST /api/export-pdf/:id` dosya adı çözümleme esnekliği.
- **Suite 3**: Çoklu sayfa taşma döngüsü sıralı indeksleme simülasyonu.
- **Suite 4**: Ctrl + Wheel yakınlaştırma sınırlandırması ([0.4, 2.0]).
- **Suite 5**: Okuyucu modu klavye olay filtreleme (input/textarea odaklanma koruması).

---

## 3. Test Komutları ve Çalıştırma Yönergeleri

| Komut | Kapsam | Amaç |
|---|---|---|
| `npm test` | Şema Doğrulama + 4 Kademeli E2E Harness | Hızlı temel doğrulama |
| `npm run validate` | `scripts/validate-issues.mjs` | JSON modellerinin kurumsal doğrulaması |
| `npm run test:unit` | `e2e-harness.mjs --tier 1` | Yalnızca Tier 1 izole özellikler |
| `npm run test:e2e` | `e2e-harness.mjs` | Tüm 4 kademeli E2E koşusu |
| `npm run test:challenger` | Challenger M1, M1-Dual, M2, M2-2 | Temel çekişmeli testler |
| `npm run test:all` | **TÜM 9 SÜİT** (Doğrulayıcı + E2E + Reviewer + Challenger M1, M1-Dual, M1-2, M2, M2-1, M2-2) | **Kapsamlı Tam Denetim** |
