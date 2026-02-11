```markdown
# 📱 QR Kod ile Yoklama Alma Sistemi

Bu proje, QR kod teknolojisi kullanarak öğrencilerin derse yoklama yapmasını sağlayan web tabanlı bir uygulamadır.

## 🚀 Özellikler

- **Öğretmen Girişi**: Basit kullanıcı adı/şifre ile giriş
- **Ders Oluşturma**: Yeni ders oluşturma ve QR kod üretimi
- **QR Kod ile Yoklama**: Öğrenciler QR kodu okutarak yoklama yapabilir
- **Tekrar Giriş Kontrolü**: Aynı cihazdan ikinci kez yoklama engelleme
- **Anlık Liste**: Öğretmen yoklama listesini canlı olarak görüntüleyebilir
- **Responsive Tasarım**: Mobil ve desktop uyumlu modern arayüz

## 🛠 Teknolojiler

### Backend
- **Node.js** - Sunucu tarafı JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - Hafif veritabanı
- **UUID** - Benzersiz ID üretimi

### Frontend
- **HTML5/CSS3** - Modern web standartları
- **Vanilla JavaScript** - Framework bağımsız
- **QRCode.js** - QR kod üretimi (CDN: cdnjs.cloudflare.com)

## 📦 Kurulum

### 1. Projeyi İndirin
```bash
# Git ile klonlayın (eğer Git repository'si ise)
git clone <repository-url>
cd CheckingWebAPP

# Veya dosyaları manuel olarak indirin
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Uygulamayı Başlatın
```bash
npm start
```

Uygulama `http://localhost:3000` adresinde çalışmaya başlayacaktır.

## 📖 Kullanım Kılavuzu

### Öğretmen Tarafı

1. **Giriş Yapın**
   - Tarayıcıda `http://localhost:3000` adresine gidin
   - Kullanıcı adı: `admin`
   - Şifre: `123456`

2. **Ders Oluşturun**
   - Ders adını girin (örn: "Matematik 101")
   - Ders tarihini seçin
   - "Ders Oluştur ve QR Kod Üret" butonuna tıklayın

3. **QR Kodu Paylaşın**
   - Oluşturulan QR kodu öğrencilere gösterin
   - Yoklama listesini canlı olarak takip edin

### Öğrenci Tarafı

1. **QR Kodu Okutun**
   - Telefon kameranızla QR kodu okutun
   - Açılan web sayfasına gidin

2. **Yoklama Yapın**
   - Ad ve soyadınızı girin
   - "Yoklama Yap" butonuna tıklayın
   - Başarı mesajını bekleyin

## 🔒 Güvenlik Özellikleri

- **IP Kontrolü**: Aynı IP adresinden tekrar yoklama engelleme
- **localStorage Kontrolü**: Browser tabanlı tekrar giriş engelleme
- **Sunucu Doğrulama**: Backend tarafında çift kontrol
- **Veri Sanitizasyonu**: Kullanıcı girdilerinin temizlenmesi

## 📊 Veritabanı Yapısı

### lessons Tablosu
```sql
id TEXT PRIMARY KEY,           -- Benzersiz ders ID (UUID)
name TEXT NOT NULL,            -- Ders adı
date TEXT NOT NULL,            -- Ders tarihi
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### attendances Tablosu
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
lesson_id TEXT NOT NULL,       -- Ders ID (Foreign Key)
student_name TEXT NOT NULL,    -- Öğrenci adı
ip_address TEXT NOT NULL,      -- IP adresi
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

## 🌐 API Endpoints

### POST `/createLesson`
Yeni ders oluşturur.

**Body:**
```json
{
  "name": "Matematik 101",
  "date": "2024-01-15"
}
```

### POST `/takeAttendance`
Öğrenci yoklaması kaydeder.

**Body:**
```json
{
  "lessonId": "uuid-string",
  "studentName": "Ahmet Yılmaz"
}
```

### GET `/lesson/:lessonId`
Ders bilgilerini getirir.

### GET `/attendanceList/:lessonId`
Ders yoklama listesini getirir.

## 🎯 Test Senaryoları

1. **Ders Oluşturma Testi**
   - Yeni ders oluşturun
   - QR kod üretimini doğrulayın

2. **Yoklama Testi**
   - QR kodu okutun
   - Ad/soyad girin ve yoklama yapın
   - Başarı mesajını doğrulayın

3. **Tekrar Giriş Testi**
   - Aynı cihazdan tekrar yoklama yapmaya çalışın
   - Engelleme mesajını doğrulayın

4. **Liste Görüntüleme**
   - Öğretmen panelinde yoklama listesini kontrol edin

## 🔧 Geliştirme

### Development Mode
```bash
npm run dev
```

Bu komut nodemon kullanarak sunucuyu otomatik yeniden başlatır.

### Veritabanı Sıfırlama
```bash
# database.sqlite dosyasını silin, uygulama yeniden oluşturacaktır
rm database.sqlite
npm start
```

## 📱 Mobil Uyumluluk

- Responsive CSS tasarımı
- Touch-friendly butonlar
- Mobil QR kod okuyucu uyumlu
- Hızlı yükleme için optimize edilmiş

## 🤝 Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında yayınlanmıştır.

## 📞 İletişim

Sorularınız için issue açabilir veya pull request gönderebilirsiniz.

---

**Geliştirici Notu**: Bu sistem eğitim amaçlı geliştirilmiştir. Üretim ortamında kullanım için ek güvenlik önlemleri alınmalıdır.
```