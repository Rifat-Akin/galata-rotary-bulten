# Yerel PDF üretim kütüphaneleri

Bu dizindeki JavaScript dosyaları tarayıcı içinde, sunucuya taslak göndermeden PDF oluşturmak için **ilk kullanımda** yüklenir.

- `html2canvas-1.4.1.min.js` — [niklasvh/html2canvas v1.4.1](https://github.com/niklasvh/html2canvas/releases/tag/v1.4.1), MIT.
- `jspdf-4.2.1.umd.min.js` — [parallax/jsPDF v4.2.1](https://github.com/parallax/jsPDF/releases/tag/v4.2.1), MIT.

Her iki kitaplık da üçüncü taraf CDN'den çalışma anında yüklenmek yerine bu repoda **sürümü sabitlenmiş** olarak tutulur. Eski jsPDF 2.x sürümleri 2026 güvenlik yamalarını içermez; bunları tekrar eklemeyin.

**Sınırlar:** Yerel PDF sayfaların yüksek çözünürlüklü JPEG görüntülerinden oluşur; dolayısıyla metin seçilebilir/aranabilir değildir. Baskıda seçilebilir vektörel metin istenirse `Yazdır > PDF olarak kaydet` veya yerel sunucuda Chrome PDF motoru kullanılabilir. Tarayıcının PDF indirmesi resmî sitede yayın **değildir**.

**Kaynak ve lisans:** Her dosyanın kendi MIT/lisans metni/kaynak başlığı kod içinde korunmuştur. İleride kütüphaneler güncellenirse bağımlılık güvenlik taramasını ve fiziksel PDF kabulünü tekrar çalıştırın.
