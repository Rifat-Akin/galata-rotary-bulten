# Galata Rotary — Fotoğraf mizanpajı / gerçek PDF görsel kabulü

**Tarih:** 2026-11-02 • **Kaynak:** `Rifat-Akin/galata-rotary-bulten`  
**Başlangıç HEAD:** `0e78861e3de1f5b6cd3bbdc672521c1357017edd`  
**Kullanıcı isteği:** Eylül/Sayı 3/sayfa 3'teki 50/50 bölünmüş görsel yerleşimini daha güçlü, profesyonel dergi kompozisyonuna dönüştür. **Tek yazar:** mevcut görev sahibi, başka kod ajanı kullanılmadı.

## Gerçek bulgu — Eylül/Sayı 3/sayfa 3

Kaynak `data/issues/2026-09-eylul.json` ilk haberindeki iki görsel şunlardır:

- `00005281.jpg` — 1054×1492, dikey eğitim etkinliği afişi.
- `00005340.jpg` — 1254×1254, Dünya Barış Günü afişi.

Eski `two-col`, A4 sayfanın kalan tüm fotoğraf alanını **iki eşit genişlikli 50/50 gri kolon** olarak dolduruyordu. Afişlerin gerçek yükseklikleri farklı olduğundan gri kolon içinde çok büyük, başarısız boş alanlar; iki görsele aynı hiyerarşi ve altta kopuk altyazı oluşuyordu. Bu durum yalnız sayfa sınırı ve geçerli PDF testleriyle yakalanmıyordu.

## Uygulanan düzeltme

- İki fotoğraf için `editorial-duo`: **2:1 ana/destek genişliği**, içeriğe bağlı doğal görsel yüksekliği, ikinci kareye hafif editoryal offset. Eski eşit `two-col` veri işareti derleyicide otomatik `editorial-duo` olarak yorumlanır.
- Görsellere `object-fit: contain`; poster/yüz/önemli nesneler kırpılmaz. Gri, tüm sayfayı kaplayan foto paneli yok. Tam kaynak altyazısı fotoğrafın hemen altında, ince altın vurgu çizgisiyle.
- Dört fotoğraf için `bento-4` eşit 2×2 kare yerine **tam genişlik ana etkinlik fotoğrafı + üç küçük destek kareden oluşan film şeridi**.
- Bazı resmî dört-fotoğraf arşivlerinde ilk görsel portre afişi/ekran görüntüsüydü. Bunların ana görsel olarak aşırı büyümesini önlemek için `renderer.js` içinde **yalnız görsel sunum sırası** için dört izlenebilir, kaynak-yollu tercih tanımlandı: `00005203` (Ağustos Zafer), `00005290` (Eylül eğitim), `00005393` (Eylül KAÇUV), `00005466` (Ekim RYLA). Fotoğraf asılları, görsel sayıları, altyazılar ve makale kaynak JSON'ları değiştirilmedi.
- Tek fotoğraflı haberde legacy `layout:two-col` gelse de ikinci boş kolon oluşturulmaz.
- Editörün `Ana + Destek / Ana + 2 Foto / Ana + 3 Foto` seçim etiketleri PDF renderer ile aynı anlama gelir. Fotoğraf ekleme/silmede mevcut kart DOM'u ve odak korunurken fotoğraf sayısına göre geçerli düzen otomatik güncellenir. Kullanıcı geçmiş özel bento seçimini yaparsa manuel kontrol çalışır.
- `renderer.js`, baskı CSS'i ve `studio.js`/PDF bağlantıları `20261102-photo10` sürümü ile güncellendi, eski JS/CSS/PDF cache ihtimali azaltıldı.

## Gerçek fiziksel PDF ve fonksiyonel test

İzole GL iş ağacında Chrome CDP ile dört PDF yeniden üretildi: **8 + 8 + 9 + 9 = 34 sayfa**. PDF.js ile yeni 34 sayfanın tamamı ve eski Eylül sayfa 3/4 fiziksel PNG'ye dönüştürüldü. Her ay için tüm-sayfa kontakt panosu görsel olarak incelendi.

- **34/34** sayfa açıldı; PDF metin koordinatlarının sayfa dışında kalması **0**.
- Eylül sayfa 3 **önce/sonra** gerçek PDF görüntüsü karşılaştırıldı. Eski iki büyük gri 50/50 panel kaldırıldı; ana afiş belirgin büyük, Barış Günü afişi destekleyici küçük.
- Eylül sayfa 4'te önceden devasa büyüyen telefon ekranı artık yardımcı kare; gerçek etkinlik fotoğrafı büyük.
- Dört sayının sayfa sayısı korunurken fotoğraf kırpılması, altyazı taşması, görsel/kapak çakışması ve A4 sınır taşması Chrome print guard ile denetlenir.
- `tests/visual-layout-contract.mjs` yeni poster/filmstrip hiyerarşisini, Eylül üçüncü sayfanın asimetrisini, legacy tek fotoğraf durumunu, kaynak görsel kimliklerini ve editör etiketlerini doğrular.
- Yerel `node --test tests/visual-layout-contract.mjs` **14/14 PASS**; HTTP güvenlik `12/12 PASS`; `npm run test:all` **PASS**, tüm M1/M2 paketleri; ayrıca gerçek tarayıcıda Eylül ilk haberinde **2 foto -> +1 foto (bento-3) -> -1 foto (editorial-duo)** akışı, active selector/başlık rozetleri/önizleme senkronu ve sıfır JS hata doğrulandı.

**Kanıt sınırı:** Yerel test, PR CI veya canlı yayının otomatik kanıtı değildir; ayrı kayıt ve kontrol gerekir. GitHub PR exact HEAD, tüm CI ve Pages yeni kaynak URL'si + gerçek PDF boyutları/sayfa sayıları kontrol edilmeden `LIVE VERIFIED` yazılmaz.

## Ayrı editoryal HOLD

Eylül ilk haber başlığı **Ritz-Carlton Açıkhava Sineması Dostluk Buluşması** iken mevcut fotoğraflar eğitim programı ve Dünya Barış Günü afişidir. Bu kaynak içerik eşlemesinin kulüp tarafından doğrulanması gerekir. Biz yanlış bir film fotoğrafı **uydurmadık/değiştirmedik**; yalnız verilen iki afişin görüntü kompozisyonunu düzelttik. Eski `02.09.2003 / 23.09.2003` kuruluş tarihi uyumsuzluğu ve özellikle çocuk fotoğraflarının telif/görüntü izinleri ayrı insan onayı gerektirir.

**Reversibility:** Bu PR yalnız sunum kodu/testi/dokümantasyonu değiştirmelidir; kaynak JSON/fotoğraf dosyaları ve PDF arşivi önceki `main` commit'inde geri alınabilir halde kalır. Yeniden oluşturulan PDF'ler sadece CI geçip güvenli canlı yayın kabulü tamamlandığında resmî `output` klasörüne işlenmelidir.