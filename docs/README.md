# QR Kod ile Yoklama Alma Sistemi
QR Kod ile Yoklama Alma Sistemi, öğrencilerin derse yoklama yapmasını sağlayan web tabanlı bir uygulamadır.

## Özellikler
- **Öğretmen Girişi**: Basit kullanıcı adı/şifre ile giriş
- **Ders Oluşturma**: Yeni ders oluşturma ve QR kod üretimi
- **QR Kod ile Yoklama**: Öğrenciler QR kodu okutarak yoklama yapabilir
- **Tekrar Giriş Kontrolü**: Aynı cihazdan ikinci kez yoklama engelleme
- **Anlık Liste**: Öğretmen yoklama listesini canlı olarak görüntüleyebilir
- **Responsive Tasarım**: Mobil ve desktop uyumlu modern arayüz

## Teknolojiler
### Backend
- **Node.js** - Sunucu tarafı JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - Hafif veritabanı
- **UUID** - Benzersiz ID üretimi

### Frontend
- **HTML5/CSS3** - Modern web standartları
- **Vanilla JavaScript** - Framework bağımsız
- **QRCode.js** - QR kod üretimi (CDN: cdnjs.cloudflare.com)

## Kurulum
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

## Kullanım Kılavuzu
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

## Güvenlik Özellikleri
- **IP Kontrolü**: Aynı IP adresinden tekrar yoklama engelleme
- **localStorage Kontrolü**: Browser tabanlı tekrar giriş engelleme
- **Sunucu Doğrulama**: Backend tarafında çift kontrol
- **Veri Sanitizasyonu**: Kullanıcı girdilerinin temizlenmesi

## Veritabanı Yapısı
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

## API Endpoints
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
  "studentName": "Öğrenci Adı",
  "ipAddress": "IP Adresi"
}
```

## Lisans
Bu proje MIT lisansı altında yayınlanmaktadır.