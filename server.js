const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Input validation and sanitization constants
const INPUT_LIMITS = {
    name: { min: 2, max: 100 },
    email: { min: 5, max: 100 },
    password: { min: 6, max: 100 },
    lessonName: { min: 2, max: 200 },
    studentName: { min: 1, max: 100 },
    locationName: { min: 1, max: 200 }
};

// Security utility functions
function sanitizeInput(input, type = 'text') {
    if (typeof input !== 'string') return '';
    
    // Remove potentially dangerous characters
    let sanitized = input
        .replace(/[<>\"']/g, '') // Remove XSS characters
        .replace(/[;&|`$()]/g, '') // Remove command injection characters
        .trim();
    
    if (type === 'name') {
        // Allow only letters, numbers, spaces, and basic punctuation for names
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.,şŞçÇğĞüÜöÖıİ]/g, '');
    } else if (type === 'email') {
        // Allow only valid email characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9@._-]/g, '');
    }
    
    return sanitized;
}

function validateInputLength(input, field) {
    if (!INPUT_LIMITS[field]) return true;
    const length = input ? input.length : 0;
    return length >= INPUT_LIMITS[field].min && length <= INPUT_LIMITS[field].max;
}

function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Enhanced security check function
function validateAndSanitizeInput(req, res, requiredFields) {
    const sanitized = {};
    
    for (const field of requiredFields) {
        const value = req.body[field];
        
        if (!value) {
            return { 
                error: true, 
                message: `${field} gereklidir.`,
                status: 400 
            };
        }
        
        const sanitizedValue = sanitizeInput(value, field);
        
        if (!validateInputLength(sanitizedValue, field)) {
            const limits = INPUT_LIMITS[field];
            return { 
                error: true, 
                message: `${field} ${limits.min} ile ${limits.max} karakter arasında olmalıdır.`,
                status: 400 
            };
        }
        
        if (field === 'email' && !isValidEmail(sanitizedValue)) {
            return { 
                error: true, 
                message: 'Geçerli bir e-posta adresi girin.',
                status: 400 
            };
        }
        
        sanitized[field] = sanitizedValue;
    }
    
    return { error: false, data: sanitized };
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' })); // Limit JSON payload size
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static('public'));

// SQLite veritabanı bağlantısı
const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası:', err.message);
    } else {
        console.log('SQLite veritabanına bağlandı.');
        initDatabase();
    }
});

// Veritabanı tablolarını oluştur
function initDatabase() {
    db.serialize(() => {
        // Öğretmenler tablosu
        db.run(`CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Dersler tablosu
        db.run(`CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            teacher_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            validity_minutes INTEGER DEFAULT 30,
            is_invalidated INTEGER DEFAULT 0,
            location_enabled INTEGER DEFAULT 0,
            center_latitude REAL,
            center_longitude REAL,
            radius_meters INTEGER DEFAULT 100,
            location_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers (id)
        )`);

        // Yoklama tablosu
        db.run(`CREATE TABLE IF NOT EXISTS attendances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            location_accuracy REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lesson_id) REFERENCES lessons (id)
        )`);

        // Konum doğrulama logları tablosu
        db.run(`CREATE TABLE IF NOT EXISTS location_validation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id TEXT NOT NULL,
            student_name TEXT,
            ip_address TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            accuracy REAL,
            distance_meters REAL,
            allowed_radius_meters INTEGER,
            validation_result TEXT NOT NULL,
            validation_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lesson_id) REFERENCES lessons (id)
        )`);

        // Add missing columns to existing tables
        db.all(`PRAGMA table_info(lessons)`, (err, columns) => {
            if (!err) {
                const columnNames = columns.map(col => col.name);
                
                // Add location columns to lessons table
                const locationColumns = [
                    { name: 'is_invalidated', type: 'INTEGER DEFAULT 0' },
                    { name: 'location_enabled', type: 'INTEGER DEFAULT 0' },
                    { name: 'center_latitude', type: 'REAL' },
                    { name: 'center_longitude', type: 'REAL' },
                    { name: 'radius_meters', type: 'INTEGER DEFAULT 100' },
                    { name: 'location_name', type: 'TEXT' }
                ];
                
                locationColumns.forEach(col => {
                    if (!columnNames.includes(col.name)) {
                        db.run(`ALTER TABLE lessons ADD COLUMN ${col.name} ${col.type}`, (err) => {
                            if (err) {
                                console.error(`${col.name} kolonu eklenirken hata:`, err.message);
                            } else {
                                console.log(`${col.name} kolonu başarıyla eklendi.`);
                            }
                        });
                    }
                });
            }
        });

        // Add location columns to attendances table
        db.all(`PRAGMA table_info(attendances)`, (err, columns) => {
            if (!err) {
                const columnNames = columns.map(col => col.name);
                
                const locationColumns = [
                    { name: 'latitude', type: 'REAL' },
                    { name: 'longitude', type: 'REAL' },
                    { name: 'location_accuracy', type: 'REAL' }
                ];
                
                locationColumns.forEach(col => {
                    if (!columnNames.includes(col.name)) {
                        db.run(`ALTER TABLE attendances ADD COLUMN ${col.name} ${col.type}`, (err) => {
                            if (err) {
                                console.error(`${col.name} kolonu eklenirken hata:`, err.message);
                            } else {
                                console.log(`${col.name} kolonu başarıyla eklendi.`);
                            }
                        });
                    }
                });
            }
        });
    });
    
    console.log('Veritabanı tabloları oluşturuldu.');
}

// Enhanced JWT token doğrulama middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Erişim reddedildi. Token gereklidir.' 
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token süresi dolmuş. Lütfen tekrar giriş yapın.' 
                });
            }
            return res.status(403).json({ 
                success: false, 
                message: 'Geçersiz token.' 
            });
        }
        req.user = user;
        next();
    });
}

// Utility functions
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            name: user.name 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function validatePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

// Haversine formula - iki koordinat arasındaki mesafeyi metre cinsinden hesaplar
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Dünya'nın yarıçapı (metre)
    const φ1 = lat1 * Math.PI / 180; // φ, λ radyan cinsinden
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = R * c; // metre cinsinden mesafe
    return distance;
}

// Gelişmiş konum doğrulama fonksiyonu
function validateLocation(studentLat, studentLon, centerLat, centerLon, radiusMeters, accuracy) {
    // GPS doğruluğu kontrolü - 100m ve üzeri kabul edilmez
    if (accuracy >= 100) {
        return {
            valid: false,
            message: 'GPS sinyali yeterince güçlü değil. Açık bir alanda olduğunuzdan emin olun ve tekrar deneyin.',
            reason: 'weak_gps'
        };
    }
    
    // Koordinat eksikliği kontrolü
    if (!studentLat || !studentLon || !centerLat || !centerLon) {
        return {
            valid: false,
            message: 'Konum bilgileri eksik. Lütfen konumunuzu paylaşın.',
            reason: 'missing_location'
        };
    }
    
    // Mesafe hesaplama
    const distance = calculateDistance(studentLat, studentLon, centerLat, centerLon);
    
    if (distance > radiusMeters) {
        return {
            valid: false,
            message: `Ders konumundan ${Math.round(distance)} metre uzaktasınız. Lütfen ders konumuna yaklaşın.`,
            reason: 'outside_range',
            distance: distance
        };
    }
    
    return {
        valid: true,
        message: 'Konum doğrulandı.',
        reason: 'success',
        distance: distance
    };
}

// Konum doğrulama sonucunu logla
function logLocationValidation(lessonId, studentName, ipAddress, latitude, longitude, accuracy, distance, allowedRadius, result, message) {
    const insertQuery = `
        INSERT INTO location_validation_logs (
            lesson_id, student_name, ip_address, latitude, longitude, 
            accuracy, distance_meters, allowed_radius_meters, 
            validation_result, validation_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        lessonId,
        studentName || null,
        ipAddress,
        latitude || null,
        longitude || null,
        accuracy || null,
        distance || null,
        allowedRadius || null,
        result, // 'success', 'location_denied', 'location_outside_range', 'weak_gps', 'missing_location'
        message || null
    ];
    
    db.run(insertQuery, values, function(err) {
        if (err) {
            console.error('Konum doğrulama logu kaydedilirken hata:', err.message);
        }
    });
}

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced öğretmen kayıt endpoint'i
app.post('/register', async (req, res) => {
    // Input validation and sanitization
    const validation = validateAndSanitizeInput(req, res, ['name', 'email', 'password']);
    if (validation.error) {
        return res.status(validation.status).json({ 
            success: false, 
            message: validation.message 
        });
    }
    
    const { name, email, password } = validation.data;

    // Mevcut kullanıcı kontrolü
    db.get('SELECT * FROM teachers WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Kullanıcı kontrol hatası:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Sunucu hatası.' 
            });
        }

        if (row) {
            return res.status(409).json({ 
                success: false, 
                message: 'Bu e-posta adresi zaten kayıtlı.' 
            });
        }

        // Şifreyi hash'le ve kullanıcıyı kaydet
        const passwordHash = hashPassword(password);
        
        db.run('INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)', 
            [name, email, passwordHash], 
            function(err) {
                if (err) {
                    console.error('Kullanıcı kaydetme hatası:', err.message);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Kayıt işlemi başarısız.' 
                    });
                }
                
                const user = {
                    id: this.lastID,
                    name: name,
                    email: email
                };
                
                const token = generateToken(user);
                
                res.json({ 
                    success: true, 
                    message: 'Kayıt başarılı.',
                    user: user,
                    token: token
                });
            }
        );
    });
});

// Enhanced öğretmen giriş endpoint'i
app.post('/login', (req, res) => {
    const validation = validateAndSanitizeInput(req, res, ['email', 'password']);
    if (validation.error) {
        return res.status(validation.status).json({ 
            success: false, 
            message: validation.message 
        });
    }
    
    const { email, password } = validation.data;

    db.get('SELECT * FROM teachers WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Giriş kontrol hatası:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Sunucu hatası.' 
            });
        }

        if (!row) {
            return res.status(401).json({ 
                success: false, 
                message: 'Geçersiz e-posta veya şifre.' 
            });
        }

        if (!validatePassword(password, row.password_hash)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Geçersiz e-posta veya şifre.' 
            });
        }

        const user = {
            id: row.id,
            name: row.name,
            email: row.email
        };

        const token = generateToken(user);

        res.json({ 
            success: true, 
            message: 'Giriş başarılı.',
            user: user,
            token: token
        });
    });
});

// Enhanced ders oluşturma endpoint'i (Authentication required)
app.post('/createLesson', authenticateToken, (req, res) => {
    const { 
        name, 
        date, 
        locationEnabled, 
        centerLatitude, 
        centerLongitude, 
        radiusMeters, 
        locationName 
    } = req.body;
    
    // Input validation
    const sanitizedName = sanitizeInput(name, 'name');
    const sanitizedLocationName = locationName ? sanitizeInput(locationName, 'name') : null;
    
    if (!validateInputLength(sanitizedName, 'lessonName')) {
        return res.status(400).json({ 
            success: false, 
            message: 'Ders adı 2 ile 200 karakter arasında olmalıdır.' 
        });
    }
    
    if (!sanitizedName || !date) {
        return res.status(400).json({ 
            success: false, 
            message: 'Ders adı ve tarih gereklidir.' 
        });
    }

    // Konum kontrolü
    if (locationEnabled) {
        if (!centerLatitude || !centerLongitude || !radiusMeters) {
            return res.status(400).json({ 
                success: false, 
                message: 'Konum kısıtlaması aktifken koordinat ve yarıçap bilgileri gereklidir.' 
            });
        }

        if (radiusMeters < 10 || radiusMeters > 10000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Yarıçap 10 ile 10000 metre arasında olmalıdır.' 
            });
        }
    }

    const lessonId = uuidv4();
    
    const query = `
        INSERT INTO lessons (
            id, teacher_id, name, date, validity_minutes, 
            location_enabled, center_latitude, center_longitude, 
            radius_meters, location_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        lessonId, 
        req.user.id, 
        sanitizedName, 
        date, 
        30,
        locationEnabled ? 1 : 0,
        locationEnabled ? centerLatitude : null,
        locationEnabled ? centerLongitude : null,
        locationEnabled ? radiusMeters : null,
        locationEnabled ? sanitizedLocationName : null
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Ders oluşturma hatası:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Ders oluşturulamadı.' 
            });
        }
        
        res.json({ 
            success: true, 
            lessonId: lessonId,
            message: 'Ders başarıyla oluşturuldu.',
            locationEnabled: locationEnabled || false
        });
    });
});

// Öğretmenin derslerini listeleme endpoint'i (Authentication required)
app.get('/myLessons', authenticateToken, (req, res) => {
    db.all('SELECT * FROM lessons WHERE teacher_id = ? ORDER BY created_at DESC', 
        [req.user.id], 
        (err, rows) => {
            if (err) {
                console.error('Dersler listeleme hatası:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Dersler listelenemedi.' 
                });
            }
            
            res.json({ 
                success: true, 
                lessons: rows
            });
        }
    );
});

// NEW: Enhanced ders silme endpoint'i (Authentication required)
app.delete('/deleteLesson/:lessonId', authenticateToken, (req, res) => {
    const lessonId = req.params.lessonId;
    
    if (!lessonId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Ders ID gereklidir.' 
        });
    }
    
    // Önce dersin bu öğretmene ait olup olmadığını kontrol et
    db.get('SELECT * FROM lessons WHERE id = ? AND teacher_id = ?', 
        [lessonId, req.user.id], 
        (err, lesson) => {
            if (err) {
                console.error('Ders kontrol hatası:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ders kontrol hatası.' 
                });
            }
            
            if (!lesson) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Ders bulunamadı veya yetkiniz yok.' 
                });
            }
            
            // Önce ilgili yoklama kayıtlarını sil
            db.run('DELETE FROM attendances WHERE lesson_id = ?', [lessonId], (err) => {
                if (err) {
                    console.error('Yoklama kayıtları silme hatası:', err.message);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Yoklama kayıtları silinemedi.' 
                    });
                }
                
                // Konum doğrulama loglarını sil
                db.run('DELETE FROM location_validation_logs WHERE lesson_id = ?', [lessonId], (err) => {
                    if (err) {
                        console.error('Konum logları silme hatası:', err.message);
                        // Kritik değil, devam et
                    }
                    
                    // Dersi sil
                    db.run('DELETE FROM lessons WHERE id = ?', [lessonId], function(err) {
                        if (err) {
                            console.error('Ders silme hatası:', err.message);
                            return res.status(500).json({ 
                                success: false, 
                                message: 'Ders silinemedi.' 
                            });
                        }
                        
                        res.json({ 
                            success: true, 
                            message: 'Ders ve tüm ilgili kayıtlar başarıyla silindi.' 
                        });
                    });
                });
            });
        }
    );
});

// QR kod geçersiz kılma endpoint'i (Authentication required)
app.post('/invalidateQR/:lessonId', authenticateToken, (req, res) => {
    const lessonId = req.params.lessonId;
    
    // Önce dersin bu öğretmene ait olup olmadığını kontrol et
    db.get('SELECT * FROM lessons WHERE id = ? AND teacher_id = ?', 
        [lessonId, req.user.id], 
        (err, row) => {
            if (err) {
                console.error('Ders kontrol hatası:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ders kontrolü yapılamadı.' 
                });
            }
            
            if (!row) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Ders bulunamadı veya yetkiniz yok.' 
                });
            }
            
            if (row.is_invalidated) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Bu QR kod zaten geçersiz kılınmış.' 
                });
            }
            
            // QR kodu geçersiz kıl
            db.run('UPDATE lessons SET is_invalidated = 1 WHERE id = ?', [lessonId], (err) => {
                if (err) {
                    console.error('QR kod geçersiz kılma hatası:', err.message);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'QR kod geçersiz kılınamadı.' 
                    });
                }
                
                res.json({ 
                    success: true, 
                    message: 'QR kod başarıyla geçersiz kılındı.' 
                });
            });
        }
    );
});

// Ders bilgisi alma endpoint'i (Public - QR kodu için)
app.get('/lesson/:lessonId', (req, res) => {
    const lessonId = req.params.lessonId;
    
    db.get('SELECT l.*, t.name as teacher_name FROM lessons l JOIN teachers t ON l.teacher_id = t.id WHERE l.id = ?', 
        [lessonId], 
        (err, row) => {
            if (err) {
                console.error('Ders bilgisi alma hatası:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ders bilgisi alınamadı.' 
                });
            }
            
            if (!row) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Ders bulunamadı.' 
                });
            }
            
            res.json({ 
                success: true, 
                lesson: row 
            });
        }
    );
});

// Enhanced yoklama alma endpoint'i (Public - Öğrenciler için)
app.post('/takeAttendance', (req, res) => {
    const { 
        lessonId, 
        studentName, 
        latitude, 
        longitude, 
        accuracy 
    } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1';
    
    // Input validation and sanitization
    if (!lessonId || !studentName) {
        return res.status(400).json({ 
            success: false, 
            message: 'Lütfen adınızı ve soyadınızı tam olarak giriniz.' 
        });
    }
    
    const sanitizedStudentName = sanitizeInput(studentName, 'name');
    if (!validateInputLength(sanitizedStudentName, 'studentName')) {
        return res.status(400).json({ 
            success: false, 
            message: 'Öğrenci adı 1 ile 100 karakter arasında olmalıdır.' 
        });
    }

    // Önce dersin var olup olmadığını kontrol et
    db.get('SELECT * FROM lessons WHERE id = ?', [lessonId], (err, lesson) => {
        if (err) {
            console.error('Ders kontrol hatası:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Ders kontrol hatası.' 
            });
        }
        
        if (!lesson) {
            return res.status(404).json({ 
                success: false, 
                message: 'Ders bulunamadı. Lütfen QR kodu tekrar okutun.' 
            });
        }

        // QR kodun geçersiz kılınıp kılınmadığını kontrol et
        if (lesson.is_invalidated) {
            return res.status(410).json({ 
                success: false, 
                message: 'Bu QR kod artık geçerli değil. Öğretmeninizle iletişime geçin.' 
            });
        }

        // Konum kontrolü (eğer etkinse)
        if (lesson.location_enabled) {
            const locationValidation = validateLocation(
                latitude, 
                longitude, 
                lesson.center_latitude, 
                lesson.center_longitude, 
                lesson.radius_meters, 
                accuracy
            );
            
            // Konum doğrulama logunu kaydet
            logLocationValidation(
                lessonId,
                sanitizedStudentName,
                clientIP,
                latitude,
                longitude,
                accuracy,
                locationValidation.distance,
                lesson.radius_meters,
                locationValidation.reason,
                locationValidation.message
            );
            
            if (!locationValidation.valid) {
                let statusCode = 403;
                if (locationValidation.reason === 'missing_location') {
                    statusCode = 400;
                }
                
                return res.status(statusCode).json({ 
                    success: false, 
                    message: locationValidation.message,
                    locationEnabled: true,
                    reason: locationValidation.reason
                });
            }
        }

        // Aynı IP adresinden bu derse daha önce yoklama yapılmış mı kontrol et
        db.get('SELECT * FROM attendances WHERE lesson_id = ? AND ip_address = ?', 
            [lessonId, clientIP], 
            (err, row) => {
                if (err) {
                    console.error('Yoklama kontrol hatası:', err.message);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Yoklama kontrolü yapılamadı.' 
                    });
                }
                
                if (row) {
                    return res.status(409).json({ 
                        success: false, 
                        message: 'Bu cihazdan daha önce yoklama yapılmış. Bir cihazdan sadece bir kez yoklama yapılabilir.' 
                    });
                }
                
                // Yeni yoklama kaydı oluştur
                const insertQuery = `
                    INSERT INTO attendances (
                        lesson_id, student_name, ip_address, 
                        latitude, longitude, location_accuracy
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                const insertValues = [
                    lessonId, 
                    sanitizedStudentName, 
                    clientIP,
                    latitude || null,
                    longitude || null,
                    accuracy || null
                ];
                
                db.run(insertQuery, insertValues, function(err) {
                    if (err) {
                        console.error('Yoklama kaydetme hatası:', err.message);
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Yoklama kaydedilemedi.' 
                        });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: 'Yoklama başarıyla kaydedildi!',
                        locationEnabled: lesson.location_enabled ? true : false,
                        distance: lesson.location_enabled && latitude && longitude ? 
                            Math.round(calculateDistance(latitude, longitude, lesson.center_latitude, lesson.center_longitude)) : null
                    });
                });
            }
        );
    });
});

// Yoklama listesi endpoint'i (Authentication required)
app.get('/attendanceList/:lessonId', authenticateToken, (req, res) => {
    const lessonId = req.params.lessonId;
    
    // Önce dersin bu öğretmene ait olup olmadığını kontrol et
    db.get('SELECT * FROM lessons WHERE id = ? AND teacher_id = ?', 
        [lessonId, req.user.id], 
        (err, lesson) => {
            if (err) {
                console.error('Ders kontrol hatası:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ders kontrol hatası.' 
                });
            }
            
            if (!lesson) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Ders bulunamadı veya yetkiniz yok.' 
                });
            }
            
            const query = `
                SELECT 
                    a.student_name,
                    a.created_at,
                    a.latitude,
                    a.longitude,
                    a.location_accuracy
                FROM attendances a
                WHERE a.lesson_id = ?
                ORDER BY a.created_at ASC
            `;
            
            db.all(query, [lessonId], (err, rows) => {
                if (err) {
                    console.error('Yoklama listesi alma hatası:', err.message);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Yoklama listesi alınamadı.' 
                    });
                }
                
                res.json({ 
                    success: true, 
                    lesson: {
                        id: lesson.id,
                        name: lesson.name,
                        date: lesson.date,
                        is_invalidated: lesson.is_invalidated
                    },
                    attendances: rows,
                    total: rows.length
                });
            });
        }
    );
});

// Sunucuyu başlat
const server = app.listen(PORT, () => {
    console.log('Veritabanı tabloları oluşturuldu.');
    console.log(`🚀 QR Yoklama Sistemi http://localhost:${PORT} adresinde çalışıyor`);
    console.log(`📝 Öğretmen kayıt: POST /register`);
    console.log(`🔐 Öğretmen giriş: POST /login`);
    console.log(`📚 Ders oluştur: POST /createLesson`);
    console.log(`📖 Derslerim: GET /myLessons`);
    console.log(`🎯 Yoklama al: POST /takeAttendance`);
    console.log(`📊 Yoklama listesi: GET /attendanceList/:lessonId`);
    console.log(`❌ QR kod geçersiz kıl: POST /invalidateQR/:lessonId`);
    console.log(`🗑️ Ders sil: DELETE /deleteLesson/:lessonId`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Sunucu kapatılıyor...');
    server.close(() => {
        db.close((err) => {
            if (err) {
                console.error('Veritabanı kapatma hatası:', err.message);
            } else {
                console.log('Veritabanı bağlantısı kapatıldı.');
            }
            process.exit(0);
        });
    });
}); 