# Galata Rotary Bülten Stüdyosu — Devralma ve Yayın Kontrolü

Tarih: 2026-10-30 (Europe/Istanbul)
Kod deposu: `Rifat-Akin/galata-rotary-bulten`
Dal: `fix/production-readiness-20261030`
Başlangıç ana dal SHA: `e102d44841d9335e07a102e884f202e5779fe941`

## Hedef

İlk dört sayının (Temmuz–Ekim 2026) veri bütünlüğünü ve kulüp kimliğini
koruyarak yerel editör + statik GitHub Pages'de yanlış çıktı, tehlikeli
sunucu erişimi, sessiz PDF kaybı ve hatalı senkronizasyon iddialarını kapatmak.

## Kanıt ve kabul yöntemleri

- Kaynak modeli: `node scripts/validate-issues.mjs`
- 9 eski kapsam paketi: `npm run test:all` (gerçek Chromium/CDP dahil)
- 12 HTTP/PDF güvenlik olumsuz testi: `node --test tests/security-http.mjs`
- Fiziksel baskı üretimi: `node scripts/export-pdf.mjs --all`
- Dört sayı / 34 sayfa / PDF bütünlük doğrulaması: `node scripts/verify-pdf-archive.mjs`
- Bağımsız PDF.js sayfa görüntüsü testi: 34/34 sayfa oluşturuldu;
  4 sayının metin sınır ölçümlerinde `clipX=0`, `clipY=0`, boş sayfa sayısı 0.
- Yerel Playwright çalışması: dört sayı 8/8/9/9 A4 sayfa;
  Temmuz 12, Ağustos 17, Eylül 20, Ekim 21 görsel; kırık görsel 0.
- Çalıştırma kanıtı gerçek GitHub Actions koşu günlüğüdür;
  bu belgedeki anlatı CI yerine geçmez.

## Kapanan somut teknik kusurlar

1. Yerel editor sunucusu yalnız `127.0.0.1` üzerinde dinler.
   Host/Origin/Cross-Site denetimi, 8 MiB istek limiti, güvenli MIME ve
   görsel imza doğrulaması vardır. SVG yüklemesi kapalıdır.
2. Kullanıcı kaynaklı görsel URL'leri protokol ve HTML attribute
   açısından filtrelenir, HTML/Toast içinde metin olarak işlenir.
3. PUT kayıtları aynı issue kimliğini gerektirir ve geçici dosyadan
   atomik olarak işlenir; başarısız yazma bir sayıyı parçalamaz.
4. Statik sayfada düzenlenmiş veya yeni taslak için eski resmî PDF
   indirilmeye çalışılmaz. Güncel taslak tarayıcı yazdırmasına yönelir.
5. Yeni ayın boş **taslak** oluşturulması statik modda da çalışır;
   gerçek toplantı/proje/baskan mesajı uydurulmaz.
6. PDF baskısı Chrome CDP `Page.printToPDF` ile çalışır.
   Görsel/font tamamlanmadan, A4 taşması varsa, PDF sayfa sayısı
   DOM ile eşleşmiyorsa dosya yayınlanmaz. Eski dosya korunur.
7. RotaClub veri senkronizasyonu bağlı değildir; yanlış başarı yerine
   501 döner ve arayüz düğmesi devre dışıdır.

## Korunan sınırlar ve kararlar

- Mevcut 4 JSON sayı ve kaynak fotoğrafları editoryal onay olmadan değiştirilmedi.
- Gerçek RotaClub API sözleşmesi/giriş yetkisi olmadan üye verisi çekilmedi.
- GitHub Pages statik modda tarayıcı taslağı **yayın değil**, kullanıcı
  isterse indirdiği JSON ile editoryal PR açabilir.
- Basit PDF imza testleri görsel QA yerine geçmez; ayrıca bağımsız
  PDF.js görüntü ve metin sayımından yararlanıldı.
- Resmî kulüp içerik onayı, kuruluş tarihi uyuşmazlığı
  (`02.09.2003` karşı `23.09.2003`) ve fotoğraf/rıza/telif
  kanıtı ayrı **editoryal HOLD** konusudur; teknik CI bunları ispat etmez.
- Canlı dağıtım ancak güncel PR/main SHA, GitHub CI ve Pages URL
  read-back ile `PASS` kabul edilir.

## Çalışma ve geri dönüş

- `main` dalı doğrudan değil, korumalı PR üzerinden değiştirilir.
- CI testleri PDF arşivini yalnız izole hedefe yazar; yayın
  adımında doğrulanmış dosyalar `output/` içine commit edilir.
- Hatalı yayımlanan PDF için GitHub'daki önceki PDF blob SHA/commit
  geri yükleme noktasıdır. `git reset --hard` veya geçmiş rewrite yok.
- Başarısız test/print/publish son baskı dosyalarının silinmesine yol açmaz.

## Devralan ajan için kesin devam noktası

`main`, açık PR'lar ve en son GitHub Actions koşusunu okuyarak
bu belgedeki tarihsel iddialarla canlı gerçeği uzlaştır.
`main` ve Pages'e alınan commit'i, Actions `build-and-test` /
`publish` / `deploy` işlerini ve dört PDF içerik izini doğrula.
RotaClub gerçek veri entegrasyonu ve editoryal insan onayı için
yeni talimat/kanıt gerekmedikçe bu sınırları aşma.