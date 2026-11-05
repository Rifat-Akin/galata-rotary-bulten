# Eylül Sayı 3 — Kuruluş tarihi kaynak uzlaştırması (2 Kasım 2026)

## Güncel kaynak kararı — 5 Kasım 2026 (önceki geçici kabulü değiştirir)

**Kabul edilen kulüp tarihi:** Kuruluş **3 Eylül 2003** (`03.09.2003`), charter **27 Ocak 2004** (`27.01.2004`). Kullanıcı, 5 Kasım 2026'da kuruluş günü konusunda **1000. Toplantı** sunumunda yazanın kabul edilmesini açıkça istemiştir. Referans: `1000. toplantı.pptx`, `Kulübümüzün Tarihçesi`, 3. slayt (20 Nisan 2026 bağlamı). Bu kaynakta kuruluş **3 Eylül 2003** olarak yazmaktadır.

Önceki 2 Eylül 2003 kaydı, 30 Ocak 2004 tarihli başka arşiv sunumunda bulunur; karşılaştırma tarihçesi aşağıda **tarihsel kanıt** olarak saklanır. Ancak **mevcut bültenin kabul edilmiş veri değeri değildir**. Önceki `Eylül 2003` belirsizlik çözümü de **HISTORICAL / SUPERSEDED** durumundadır.

Bu karar ile dört aylık bültenin `club.foundationDate` alanı, sunucu yeni sayı varsayılanı, PDF renderer yedeği ve test fixture tarihleri `03.09.2003` olarak eşitlenmiştir. Eylül Sayı 3 başkan mesajı ve anı haberi **3 Eylül 2003** diye güncellenmiştir. Eylül 2026 anı haberi `date` alanı olay günü kanıtı olmadığından **Eylül 2026** kalır; 2019 tarihli fotoğraf açıklaması gün bilgisini korur. Fotoğraf hakları ve yanlış etkinlik-görsel eşleşmesi ayrı editoryal meselelerdir.

---

## Tarihsel inceleme — 2 Kasım 2026 (güncel karar değildir)

### Doğrulananlar

- Kullanıcının işaret ettiği **Galata Rotary 1000. toplantı sunumu** (`1000. toplantı.pptx`, 20 Nisan 2026 bağlamı), `Kulübümüzün Tarihçesi` başlıklı 3. slaytta **Kuruluş: 3 Eylül 2003; Charter: 27 Ocak 2004** diyor. Kulüp arşivindeki önceki taslak aynı tarihi yalnız **Eylül 2003** diye yazıyor.
- **30 Ocak 2004 / 2003–2004 Dördüncü Asamble** sunumu (5. ve 7. slayt), **Kuruluş: 02.09.2003** diyor. Açık kaynak: https://www.slideserve.com/malaya/galata-rotary-kul-b
- Bu iki kulüp kaynağı **kesin gün açısından çelişiyor** (2 ve 3 Eylül). İkisi de eski bülten anlatısındaki **23 Eylül 2003** iddiasını desteklemiyor.
- Eylül sayısındaki charter bilgisi **27.01.2004** olarak korunuyor; ayrı arşiv belgelerinde charter müracaatı / charter tarihi kullanımı da tutarlı olmadığından bu çalışma charter incelemesi yapmaz.

## Düzenleme kararı

- **Doğrulanamayan günü uydurmadan**, Eylül 2026 bültenindeki **kuruluş referansları 'Eylül 2003'** olarak verildi.
- Başkan mesajının yanlış **23 Eylül 2003** ifadesi çıkarıldı; 23. yıl vurgusu korundu.
- 'Galata Rotary Kulübü 23. Yaşında' haberinin tarihi, doğrulanmamış 23 Eylül 2026 kutlama olayı ileri sürülmesin diye **Eylül 2026** biçimine alındı.
- 23 Eylül 2019 tarihli arşiv görselinin **tarihi korunarak**, açıklamadaki **Kuruluş Yıldönümü** tanımı çıkarıldı: `23 Eylül 2019 Dostluk Hatırası`.
- Diğer olay tarihleri, beş haber, görseller, alt yazıların kimlikleri ve PDF sayfa sayısı değiştirilmedi.
- **Diğer sayılar kapsam dışı:** Temmuz/Ağustos/Ekim tarihleri otomatik değiştirilmedi. Kullanıcı ya da resmi tarih kaydı kesin günü doğruladığında tüm sayılar ayrıca tutarlı güncellenmeli.

## Yayın kapısı

PR exact-head CI, 9 sayfalık Eylül PDF, diğer üç aylık PDF arşivi, canlı GitHub Pages okuması ve kaynak metin read-back geçmeden 'canlı düzeltildi' denmemeli. Geri dönüş için önceki `main` ve PDF blobları korunur.
