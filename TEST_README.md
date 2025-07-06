# 🧪 QR Attendance System Test Suite

Bu klasörde QR yoklama sistemi için kapsamlı test paketi bulunmaktadır.

## 📁 Test Dosyaları

- `test-suite.js` - Ana test paketi (30 test senaryosu)
- `run-tests.js` - Test çalıştırıcı (sunucu kontrolü ile)
- `TEST_REPORT.md` - Detaylı test raporu
- `TEST_README.md` - Bu dosya

## 🚀 Testleri Nasıl Çalıştırırım?

### 1. Sunucuyu Başlatın
```bash
npm start
```

### 2. Testleri Çalıştırın (Yeni terminal penceresi)
```bash
node run-tests.js
```

### Veya Otomatik Test (Sunucu kontrolü ile)
```bash
# Sunucu otomatik kontrol edilir
node run-tests.js
```

## 🧪 Test Kapsamı

### ✅ Temel Özellikler
- Öğretmen kaydı ve girişi
- Ders oluşturma (konumlu/konumsuz)
- Öğrenci yoklama alma
- QR kod geçersiz kılma
- Yoklama listesi görüntüleme

### 📍 Konum Tabanlı Testler
- GPS koordinat doğrulama
- Yarıçap dışında kalma kontrolü
- Zayıf GPS sinyali testi
- Eksik konum bilgisi testi

### 🔒 Güvenlik Testleri
- Kimlik doğrulama kontrolleri
- Tekrar yoklama engelleme
- Geçersiz token testleri

## 📊 Test Sonuçları

Son test sonuçları için `TEST_REPORT.md` dosyasını inceleyin.

## 🛠 Test Konfigürasyonu

Test ayarlarını değiştirmek için `test-suite.js` içindeki `CONFIG` objesini düzenleyin:

```javascript
const CONFIG = {
    baseUrl: 'http://localhost:3000',  // Sunucu adresi
    testTimeout: 10000,                // İstek timeout süresi
    locations: {                       // Test koordinatları
        center: { lat: 41.0082, lon: 28.9784 },
        inside: { lat: 41.0083, lon: 28.9785 },
        // ...
    }
};
```

## 🔍 Hata Durumunda

1. **Sunucu çalışmıyor hatası**: `npm start` ile sunucuyu başlatın
2. **Bağlantı hatası**: Port 3000'in boş olduğundan emin olun
3. **Test başarısız**: Test raporunu kontrol edin ve server.js loglarını inceleyin

## 📈 Test Raporları

Her test çalıştırmasından sonra:
- Konsol çıktısında özet rapor görüntülenir
- Detaylı analiz için `TEST_REPORT.md` güncellenir
- Veritabanında test kayıtları oluşturulur

## 🔄 Test Verilerini Temizleme

```bash
# Veritabanını sıfırla
rm database.sqlite

# Sunucuyu yeniden başlat
npm start
``` 