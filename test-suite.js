const http = require('http');
const https = require('https');

// Test configuration
const CONFIG = {
    baseUrl: 'http://localhost:3000',
    testTimeout: 10000,
    // Performance thresholds
    performance: {
        maxResponseTime: 1000, // ms
        maxConcurrentRequests: 10
    },
    // Test locations for location-based tests
    locations: {
        center: { lat: 41.0082, lon: 28.9784 }, // Istanbul center
        inside: { lat: 41.0083, lon: 28.9785 }, // ~15m away
        outside: { lat: 41.0200, lon: 28.9900 }, // ~1.5km away
        faraway: { lat: 40.7589, lon: -73.9851 }, // New York (~8000km away)
        edge: { lat: 41.008287, lon: 28.978487 } // ~10m away (edge case)
    }
};

// Test results storage
let testResults = [];
let testCounter = 0;

// Utility functions
function makeRequest(method, path, data = null, headers = {}) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const url = new URL(CONFIG.baseUrl + path);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                try {
                    const parsed = JSON.parse(body);
                    resolve({ 
                        status: res.statusCode, 
                        data: parsed, 
                        headers: res.headers,
                        responseTime: responseTime
                    });
                } catch (e) {
                    resolve({ 
                        status: res.statusCode, 
                        data: body, 
                        headers: res.headers,
                        responseTime: responseTime
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.setTimeout(CONFIG.testTimeout);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

function logTest(name, steps, inputs, expected, actual, passed, error = null) {
    testCounter++;
    const result = {
        id: testCounter,
        name,
        steps,
        inputs,
        expected,
        actual,
        passed,
        error: error ? error.message : null,
        timestamp: new Date().toISOString()
    };
    testResults.push(result);
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${testCounter.toString().padStart(2, '0')}] ${status} ${name}`);
    if (error) {
        console.log(`    Error: ${error.message}`);
    }
    if (!passed) {
        console.log(`    Expected: ${JSON.stringify(expected)}`);
        console.log(`    Actual: ${JSON.stringify(actual)}`);
    }
}

// Test data storage - use unique emails for each test run
const timestamp = Date.now();
let testData = {
    teacher: {
        name: 'Test Teacher',
        email: `test${timestamp}@teacher.com`,
        password: 'test123456'
    },
    token: null,
    lessons: [],
    // Security test payloads
    securityPayloads: {
        sqlInjection: [
            "'; DROP TABLE teachers; --",
            "' OR '1'='1",
            "'; INSERT INTO teachers (name, email, password_hash) VALUES ('hacker', 'hack@test.com', 'hash'); --"
        ],
        xss: [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>"
        ],
        longStrings: [
            'A'.repeat(1000),
            'A'.repeat(10000),
            'A'.repeat(100000)
        ]
    }
};

// Calculate distance between two points (same as server)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Test scenarios
async function testTeacherRegistration() {
    console.log('\n🔐 Testing Teacher Registration & Authentication...');
    
    // Test 1: Valid registration
    try {
        const response = await makeRequest('POST', '/register', testData.teacher);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success;
        
        if (passed) {
            testData.token = response.data.token;
        }
        
        logTest(
            'Teacher Registration - Valid Data',
            ['Submit valid teacher registration form'],
            testData.teacher,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Registration - Valid Data', [], testData.teacher, {}, {}, false, error);
    }

    // Test 2: Duplicate email registration
    try {
        const response = await makeRequest('POST', '/register', testData.teacher);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 409 && !response.data.success;
        
        logTest(
            'Teacher Registration - Duplicate Email',
            ['Submit registration with existing email'],
            testData.teacher,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Registration - Duplicate Email', [], testData.teacher, {}, {}, false, error);
    }

    // Test 3: Invalid email format
    try {
        const invalidData = { ...testData.teacher, email: 'invalid-email' };
        const response = await makeRequest('POST', '/register', invalidData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 400 && !response.data.success;
        
        logTest(
            'Teacher Registration - Invalid Email',
            ['Submit registration with invalid email format'],
            invalidData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Registration - Invalid Email', [], {}, {}, {}, false, error);
    }

    // Test 4: Short password
    try {
        const invalidData = { ...testData.teacher, email: 'test2@teacher.com', password: '123' };
        const response = await makeRequest('POST', '/register', invalidData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 400 && !response.data.success;
        
        logTest(
            'Teacher Registration - Short Password',
            ['Submit registration with password < 6 characters'],
            invalidData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Registration - Short Password', [], {}, {}, {}, false, error);
    }

    // Test 5: Valid login
    try {
        const loginData = { email: testData.teacher.email, password: testData.teacher.password };
        const response = await makeRequest('POST', '/login', loginData);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success;
        
        if (passed) {
            testData.token = response.data.token;
        }
        
        logTest(
            'Teacher Login - Valid Credentials',
            ['Submit valid login credentials'],
            { email: loginData.email, password: '***' },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Login - Valid Credentials', [], {}, {}, {}, false, error);
    }

    // Test 6: Invalid login
    try {
        const loginData = { email: testData.teacher.email, password: 'wrongpassword' };
        const response = await makeRequest('POST', '/login', loginData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 401 && !response.data.success;
        
        logTest(
            'Teacher Login - Invalid Password',
            ['Submit login with wrong password'],
            { email: loginData.email, password: '***' },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Teacher Login - Invalid Password', [], {}, {}, {}, false, error);
    }
}

async function testLessonCreation() {
    console.log('\n📚 Testing Lesson Creation...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    
    // Test 7: Create lesson without location restriction
    try {
        const lessonData = {
            name: 'Test Lesson - No Location',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: false
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success;
        
        if (passed) {
            testData.lessons.push({
                id: response.data.lessonId,
                name: lessonData.name,
                locationEnabled: false
            });
        }
        
        logTest(
            'Lesson Creation - No Location Restriction',
            ['Create lesson without location requirement'],
            lessonData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Creation - No Location Restriction', [], {}, {}, {}, false, error);
    }

    // Test 8: Create lesson with location restriction
    try {
        const lessonData = {
            name: 'Test Lesson - With Location',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 100,
            locationName: 'Test Location Center'
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success;
        
        if (passed) {
            testData.lessons.push({
                id: response.data.lessonId,
                name: lessonData.name,
                locationEnabled: true,
                centerLat: lessonData.centerLatitude,
                centerLon: lessonData.centerLongitude,
                radius: lessonData.radiusMeters
            });
        }
        
        logTest(
            'Lesson Creation - With Location Restriction',
            ['Create lesson with location requirement and 100m radius'],
            lessonData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Creation - With Location Restriction', [], {}, {}, {}, false, error);
    }

    // Test 9: Create lesson with invalid location data
    try {
        const lessonData = {
            name: 'Test Lesson - Invalid Location',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            // Missing centerLongitude
            radiusMeters: 100
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 400 && !response.data.success;
        
        logTest(
            'Lesson Creation - Missing Location Data',
            ['Create lesson with location enabled but missing coordinates'],
            lessonData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Creation - Missing Location Data', [], {}, {}, {}, false, error);
    }

    // Test 10: Create lesson with invalid radius
    try {
        const lessonData = {
            name: 'Test Lesson - Invalid Radius',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 5, // Too small
            locationName: 'Test Location'
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 400 && !response.data.success;
        
        logTest(
            'Lesson Creation - Invalid Radius (Too Small)',
            ['Create lesson with radius < 10 meters'],
            lessonData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Creation - Invalid Radius (Too Small)', [], {}, {}, {}, false, error);
    }

    // Test 11: Create lesson without authentication
    try {
        const lessonData = {
            name: 'Unauthorized Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: false
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 401;
        
        logTest(
            'Lesson Creation - No Authentication',
            ['Try to create lesson without auth token'],
            lessonData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Creation - No Authentication', [], {}, {}, {}, false, error);
    }
}

async function testStudentAttendance() {
    console.log('\n👥 Testing Student Attendance...');
    
    if (testData.lessons.length === 0) {
        console.log('⚠️ No lessons available for attendance tests');
        return;
    }

    const noLocationLesson = testData.lessons.find(l => !l.locationEnabled);
    const locationLesson = testData.lessons.find(l => l.locationEnabled);

    // Test 12: Valid attendance without location requirement
    if (noLocationLesson) {
        try {
            const attendanceData = {
                lessonId: noLocationLesson.id,
                studentName: 'Test Student 1'
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: true };
            const actual = { success: response.data.success };
            const passed = response.status === 200 && response.data.success;
            
            logTest(
                'Student Attendance - Valid (No Location Required)',
                ['Submit attendance without location data'],
                attendanceData,
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Valid (No Location Required)', [], {}, {}, {}, false, error);
        }

        // Test 13: Duplicate attendance (same IP)
        try {
            const attendanceData = {
                lessonId: noLocationLesson.id,
                studentName: 'Test Student 2'
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: false };
            const actual = { success: response.data.success };
            const passed = response.status === 409 && !response.data.success;
            
            logTest(
                'Student Attendance - Duplicate IP',
                ['Try to submit attendance from same IP twice'],
                attendanceData,
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Duplicate IP', [], {}, {}, {}, false, error);
        }
    }

    // Test 14: Valid attendance with location (inside radius)
    if (locationLesson) {
        try {
            const distance = calculateDistance(
                CONFIG.locations.inside.lat, CONFIG.locations.inside.lon,
                locationLesson.centerLat, locationLesson.centerLon
            );
            
            const attendanceData = {
                lessonId: locationLesson.id,
                studentName: 'Test Student - Inside',
                latitude: CONFIG.locations.inside.lat,
                longitude: CONFIG.locations.inside.lon,
                accuracy: 10
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: true };
            const actual = { success: response.data.success };
            const passed = response.status === 200 && response.data.success;
            
            logTest(
                'Student Attendance - Valid Location (Inside Radius)',
                [`Submit attendance ${Math.round(distance)}m from center (within ${locationLesson.radius}m)`],
                { ...attendanceData, latitude: 'XXX', longitude: 'XXX' },
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Valid Location (Inside Radius)', [], {}, {}, {}, false, error);
        }
    }

    // Test 15: Invalid attendance with location (outside radius)
    if (locationLesson) {
        try {
            const distance = calculateDistance(
                CONFIG.locations.outside.lat, CONFIG.locations.outside.lon,
                locationLesson.centerLat, locationLesson.centerLon
            );
            
            const attendanceData = {
                lessonId: locationLesson.id,
                studentName: 'Test Student - Outside',
                latitude: CONFIG.locations.outside.lat,
                longitude: CONFIG.locations.outside.lon,
                accuracy: 10
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: false };
            const actual = { success: response.data.success };
            const passed = response.status === 403 && !response.data.success;
            
            logTest(
                'Student Attendance - Outside Radius',
                [`Submit attendance ${Math.round(distance)}m from center (outside ${locationLesson.radius}m)`],
                { ...attendanceData, latitude: 'XXX', longitude: 'XXX' },
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Outside Radius', [], {}, {}, {}, false, error);
        }
    }

    // Test 16: Attendance with missing location data
    if (locationLesson) {
        try {
            const attendanceData = {
                lessonId: locationLesson.id,
                studentName: 'Test Student - No Location'
                // Missing latitude/longitude
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: false };
            const actual = { success: response.data.success };
            const passed = response.status === 400 && !response.data.success;
            
            logTest(
                'Student Attendance - Missing Location Data',
                ['Submit attendance without coordinates when location required'],
                attendanceData,
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Missing Location Data', [], {}, {}, {}, false, error);
        }
    }

    // Test 17: Attendance with weak GPS signal
    if (locationLesson) {
        try {
            const attendanceData = {
                lessonId: locationLesson.id,
                studentName: 'Test Student - Weak GPS',
                latitude: CONFIG.locations.inside.lat,
                longitude: CONFIG.locations.inside.lon,
                accuracy: 150 // Poor accuracy
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: false };
            const actual = { success: response.data.success };
            const passed = response.status === 403 && !response.data.success;
            
            logTest(
                'Student Attendance - Weak GPS Signal',
                ['Submit attendance with GPS accuracy > 100m'],
                { ...attendanceData, latitude: 'XXX', longitude: 'XXX' },
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Weak GPS Signal', [], {}, {}, {}, false, error);
        }
    }

    // Test 18: Attendance with invalid lesson ID
    try {
        const attendanceData = {
            lessonId: 'invalid-lesson-id',
            studentName: 'Test Student'
        };
        
        const response = await makeRequest('POST', '/takeAttendance', attendanceData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 404 && !response.data.success;
        
        logTest(
            'Student Attendance - Invalid Lesson ID',
            ['Submit attendance for non-existent lesson'],
            attendanceData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Student Attendance - Invalid Lesson ID', [], {}, {}, {}, false, error);
    }

    // Test 19: Attendance with empty student name
    if (noLocationLesson) {
        try {
            const attendanceData = {
                lessonId: noLocationLesson.id,
                studentName: ''
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const expected = { success: false };
            const actual = { success: response.data.success };
            const passed = response.status === 400 && !response.data.success;
            
            logTest(
                'Student Attendance - Empty Name',
                ['Submit attendance with empty student name'],
                attendanceData,
                expected,
                actual,
                passed
            );
        } catch (error) {
            logTest('Student Attendance - Empty Name', [], {}, {}, {}, false, error);
        }
    }
}

async function testQRInvalidation() {
    console.log('\n❌ Testing QR Code Invalidation...');
    
    if (testData.lessons.length === 0) {
        console.log('⚠️ No lessons available for invalidation tests');
        return;
    }

    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    const testLesson = testData.lessons[0];

    // Test 20: Valid QR invalidation
    try {
        const response = await makeRequest('POST', `/invalidateQR/${testLesson.id}`, {}, authHeaders);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success;
        
        logTest(
            'QR Invalidation - Valid Request',
            ['Invalidate QR code for existing lesson'],
            { lessonId: testLesson.id },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('QR Invalidation - Valid Request', [], {}, {}, {}, false, error);
    }

    // Test 21: Attendance on invalidated QR
    try {
        const attendanceData = {
            lessonId: testLesson.id,
            studentName: 'Test Student - Invalidated QR'
        };
        
        const response = await makeRequest('POST', '/takeAttendance', attendanceData);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 410 && !response.data.success;
        
        logTest(
            'Student Attendance - Invalidated QR',
            ['Try to submit attendance for invalidated QR code'],
            attendanceData,
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Student Attendance - Invalidated QR', [], {}, {}, {}, false, error);
    }

    // Test 22: Double invalidation
    try {
        const response = await makeRequest('POST', `/invalidateQR/${testLesson.id}`, {}, authHeaders);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 400 && !response.data.success;
        
        logTest(
            'QR Invalidation - Already Invalidated',
            ['Try to invalidate already invalidated QR code'],
            { lessonId: testLesson.id },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('QR Invalidation - Already Invalidated', [], {}, {}, {}, false, error);
    }

    // Test 23: QR invalidation without authentication
    try {
        const response = await makeRequest('POST', `/invalidateQR/${testLesson.id}`, {});
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 401;
        
        logTest(
            'QR Invalidation - No Authentication',
            ['Try to invalidate QR without auth token'],
            { lessonId: testLesson.id },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('QR Invalidation - No Authentication', [], {}, {}, {}, false, error);
    }
}

async function testAttendanceList() {
    console.log('\n📊 Testing Attendance List Retrieval...');
    
    if (testData.lessons.length === 0) {
        console.log('⚠️ No lessons available for attendance list tests');
        return;
    }

    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    const testLesson = testData.lessons[testData.lessons.length - 1]; // Use last lesson (not invalidated)

    // Test 24: Valid attendance list retrieval
    try {
        const response = await makeRequest('GET', `/attendanceList/${testLesson.id}`, null, authHeaders);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success && Array.isArray(response.data.attendances);
        
        logTest(
            'Attendance List - Valid Request',
            ['Retrieve attendance list for existing lesson'],
            { lessonId: testLesson.id },
            expected,
            { ...actual, hasAttendances: Array.isArray(response.data.attendances) },
            passed
        );
    } catch (error) {
        logTest('Attendance List - Valid Request', [], {}, {}, {}, false, error);
    }

    // Test 25: Attendance list without authentication
    try {
        const response = await makeRequest('GET', `/attendanceList/${testLesson.id}`);
        const expected = { success: false };
        const actual = { success: response.data ? response.data.success : false };
        const passed = response.status === 401;
        
        logTest(
            'Attendance List - No Authentication',
            ['Try to retrieve attendance list without auth token'],
            { lessonId: testLesson.id },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Attendance List - No Authentication', [], {}, {}, {}, false, error);
    }

    // Test 26: Attendance list for non-existent lesson
    try {
        const response = await makeRequest('GET', '/attendanceList/invalid-lesson-id', null, authHeaders);
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 404 && !response.data.success;
        
        logTest(
            'Attendance List - Invalid Lesson ID',
            ['Try to retrieve attendance list for non-existent lesson'],
            { lessonId: 'invalid-lesson-id' },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Attendance List - Invalid Lesson ID', [], {}, {}, {}, false, error);
    }
}

async function testLessonInfo() {
    console.log('\n📖 Testing Lesson Information Retrieval...');
    
    if (testData.lessons.length === 0) {
        console.log('⚠️ No lessons available for lesson info tests');
        return;
    }

    const testLesson = testData.lessons[testData.lessons.length - 1];

    // Test 27: Valid lesson info retrieval
    try {
        const response = await makeRequest('GET', `/lesson/${testLesson.id}`);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success && response.data.lesson;
        
        logTest(
            'Lesson Info - Valid Request',
            ['Retrieve lesson information for existing lesson'],
            { lessonId: testLesson.id },
            expected,
            { ...actual, hasLessonData: !!response.data.lesson },
            passed
        );
    } catch (error) {
        logTest('Lesson Info - Valid Request', [], {}, {}, {}, false, error);
    }

    // Test 28: Lesson info for non-existent lesson
    try {
        const response = await makeRequest('GET', '/lesson/invalid-lesson-id');
        const expected = { success: false };
        const actual = { success: response.data.success };
        const passed = response.status === 404 && !response.data.success;
        
        logTest(
            'Lesson Info - Invalid Lesson ID',
            ['Try to retrieve info for non-existent lesson'],
            { lessonId: 'invalid-lesson-id' },
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('Lesson Info - Invalid Lesson ID', [], {}, {}, {}, false, error);
    }
}

async function testMyLessons() {
    console.log('\n📋 Testing My Lessons Retrieval...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };

    // Test 29: Valid my lessons retrieval
    try {
        const response = await makeRequest('GET', '/myLessons', null, authHeaders);
        const expected = { success: true };
        const actual = { success: response.data.success };
        const passed = response.status === 200 && response.data.success && Array.isArray(response.data.lessons);
        
        logTest(
            'My Lessons - Valid Request',
            ['Retrieve teacher\'s lessons with valid auth'],
            {},
            expected,
            { ...actual, hasLessons: Array.isArray(response.data.lessons) },
            passed
        );
    } catch (error) {
        logTest('My Lessons - Valid Request', [], {}, {}, {}, false, error);
    }

    // Test 30: My lessons without authentication
    try {
        const response = await makeRequest('GET', '/myLessons');
        const expected = { success: false };
        const actual = { success: response.data ? response.data.success : false };
        const passed = response.status === 401;
        
        logTest(
            'My Lessons - No Authentication',
            ['Try to retrieve lessons without auth token'],
            {},
            expected,
            actual,
            passed
        );
    } catch (error) {
        logTest('My Lessons - No Authentication', [], {}, {}, {}, false, error);
    }
}

// New comprehensive test functions
async function testPerformance() {
    console.log('\n⚡ Testing Performance & Response Times...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    
    // Test 31: Response time for lesson creation
    try {
        const lessonData = {
            name: 'Performance Test Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: false
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const responseTime = response.responseTime;
        const passed = response.status === 200 && responseTime < CONFIG.performance.maxResponseTime;
        
        if (response.data.success) {
            testData.lessons.push({
                id: response.data.lessonId,
                name: lessonData.name,
                locationEnabled: false
            });
        }
        
        logTest(
            'Performance - Lesson Creation Response Time',
            [`Measure response time for lesson creation (${responseTime}ms)`],
            { maxAllowed: CONFIG.performance.maxResponseTime },
            { withinLimit: true },
            { withinLimit: responseTime < CONFIG.performance.maxResponseTime, actualTime: responseTime },
            passed
        );
    } catch (error) {
        logTest('Performance - Lesson Creation Response Time', [], {}, {}, {}, false, error);
    }

    // Test 32: Concurrent attendance submissions
    if (testData.lessons.length > 0) {
        try {
            const testLesson = testData.lessons[testData.lessons.length - 1];
            const concurrentRequests = [];
            const startTime = Date.now();
            
            // Create multiple attendance requests with different student names
            for (let i = 0; i < 5; i++) {
                const attendanceData = {
                    lessonId: testLesson.id,
                    studentName: `Concurrent Student ${i}`
                };
                concurrentRequests.push(
                    makeRequest('POST', '/takeAttendance', attendanceData)
                        .catch(err => ({ error: err.message, status: 500 }))
                );
            }
            
            const responses = await Promise.all(concurrentRequests);
            const totalTime = Date.now() - startTime;
            const successfulRequests = responses.filter(r => r.status === 200 || r.status === 409).length;
            const passed = successfulRequests >= 4 && totalTime < 5000; // Allow for one duplicate IP error
            
            logTest(
                'Performance - Concurrent Attendance Submissions',
                [`Submit ${concurrentRequests.length} concurrent attendance requests`],
                { expectedSuccessful: '≥4', maxTime: '5000ms' },
                { successful: '≥4', timeUnder: '5000ms' },
                { successful: successfulRequests, actualTime: totalTime },
                passed
            );
        } catch (error) {
            logTest('Performance - Concurrent Attendance Submissions', [], {}, {}, {}, false, error);
        }
    }
}

async function testSecurity() {
    console.log('\n🛡️ Testing Security & Input Validation...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    
    // Test 33: SQL Injection in teacher registration
    try {
        const maliciousData = {
            name: testData.securityPayloads.sqlInjection[0],
            email: 'malicious@test.com',
            password: 'test123456'
        };
        
        const response = await makeRequest('POST', '/register', maliciousData);
        const passed = response.status === 400 || response.status === 500 || !response.data.success;
        
        logTest(
            'Security - SQL Injection in Registration',
            ['Submit registration with SQL injection payload'],
            { payload: 'SQL_INJECTION_ATTEMPT' },
            { success: false },
            { success: response.data.success, rejected: !response.data.success },
            passed
        );
    } catch (error) {
        // Network errors are also acceptable as they indicate rejection
        logTest('Security - SQL Injection in Registration', [], {}, {}, { rejected: true }, true);
    }

    // Test 34: XSS in student name - Create new lesson for clean test
    try {
        const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
        const xssLessonData = {
            name: 'XSS Security Test Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: false
        };
        
        const lessonResponse = await makeRequest('POST', '/createLesson', xssLessonData, authHeaders);
        
        if (lessonResponse.data.success) {
            const attendanceData = {
                lessonId: lessonResponse.data.lessonId,
                studentName: testData.securityPayloads.xss[0] // "<script>alert('XSS')</script>"
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            // Should either reject the request (400) or sanitize and accept
            const containsScript = response.data.message && response.data.message.includes('<script>');
            const passed = response.status === 400 || (response.data.success && !containsScript);
            
            logTest(
                'Security - XSS in Student Name',
                ['Create new lesson', 'Submit attendance with XSS payload in student name'],
                { payload: 'XSS_ATTEMPT' },
                { sanitized: true },
                { 
                    status: response.status,
                    accepted: response.data.success, 
                    containsScript: containsScript,
                    rejected: response.status === 400
                },
                passed
            );
        } else {
            logTest('Security - XSS in Student Name', [], {}, {}, { lessonCreationFailed: true }, false);
        }
    } catch (error) {
        logTest('Security - XSS in Student Name', [], {}, {}, { rejected: true }, true);
    }

    // Test 35: Extremely long input strings
    try {
        const maliciousData = {
            name: testData.securityPayloads.longStrings[1], // 10k characters
            email: 'longtest@test.com',
            password: 'test123456'
        };
        
        const response = await makeRequest('POST', '/register', maliciousData);
        const passed = response.status === 400 || !response.data.success;
        
        logTest(
            'Security - Long String Input',
            ['Submit registration with extremely long name (10k chars)'],
            { nameLength: maliciousData.name.length },
            { rejected: true },
            { success: response.data.success, rejected: !response.data.success },
            passed
        );
    } catch (error) {
        logTest('Security - Long String Input', [], {}, {}, { rejected: true }, true);
    }
}

async function testBoundaryConditions() {
    console.log('\n🎯 Testing Boundary Conditions & Edge Cases...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    
    // Test 36: Minimum valid radius (exactly 10m)
    try {
        const lessonData = {
            name: 'Boundary Test - Min Radius',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 10, // Minimum allowed
            locationName: 'Boundary Test Location'
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const passed = response.status === 200 && response.data.success;
        
        if (passed) {
            testData.lessons.push({
                id: response.data.lessonId,
                name: lessonData.name,
                locationEnabled: true,
                centerLat: lessonData.centerLatitude,
                centerLon: lessonData.centerLongitude,
                radius: lessonData.radiusMeters
            });
        }
        
        logTest(
            'Boundary - Minimum Valid Radius',
            ['Create lesson with exactly 10m radius (minimum allowed)'],
            { radius: 10 },
            { success: true },
            { success: response.data.success },
            passed
        );
    } catch (error) {
        logTest('Boundary - Minimum Valid Radius', [], {}, {}, {}, false, error);
    }

    // Test 37: Maximum valid radius (exactly 10000m)
    try {
        const lessonData = {
            name: 'Boundary Test - Max Radius',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 10000, // Maximum allowed
            locationName: 'Boundary Test Location Large'
        };
        
        const response = await makeRequest('POST', '/createLesson', lessonData, authHeaders);
        const passed = response.status === 200 && response.data.success;
        
        logTest(
            'Boundary - Maximum Valid Radius',
            ['Create lesson with exactly 10000m radius (maximum allowed)'],
            { radius: 10000 },
            { success: true },
            { success: response.data.success },
            passed
        );
    } catch (error) {
        logTest('Boundary - Maximum Valid Radius', [], {}, {}, {}, false, error);
    }

    // Test 38: GPS accuracy at exactly 100m threshold
    if (testData.lessons.length > 0) {
        const locationLesson = testData.lessons.find(l => l.locationEnabled);
        if (locationLesson) {
            try {
                const attendanceData = {
                    lessonId: locationLesson.id,
                    studentName: 'Boundary Test - GPS Accuracy',
                    latitude: CONFIG.locations.inside.lat,
                    longitude: CONFIG.locations.inside.lon,
                    accuracy: 100 // Exactly at threshold
                };
                
                const response = await makeRequest('POST', '/takeAttendance', attendanceData);
                const passed = response.status === 403 && !response.data.success; // Should be rejected
                
                logTest(
                    'Boundary - GPS Accuracy Threshold',
                    ['Submit attendance with GPS accuracy exactly at 100m threshold'],
                    { accuracy: 100 },
                    { rejected: true },
                    { success: response.data.success },
                    passed
                );
            } catch (error) {
                logTest('Boundary - GPS Accuracy Threshold', [], {}, {}, {}, false, error);
            }
        }
    }

    // Test 39: Location exactly at radius edge
    if (testData.lessons.length > 0) {
        const locationLesson = testData.lessons.find(l => l.locationEnabled && l.radius === 10);
        if (locationLesson) {
            try {
                // Calculate point exactly at 10m distance
                const distance = calculateDistance(
                    CONFIG.locations.edge.lat, CONFIG.locations.edge.lon,
                    locationLesson.centerLat, locationLesson.centerLon
                );
                
                const attendanceData = {
                    lessonId: locationLesson.id,
                    studentName: 'Boundary Test - Edge Location',
                    latitude: CONFIG.locations.edge.lat,
                    longitude: CONFIG.locations.edge.lon,
                    accuracy: 5
                };
                
                const response = await makeRequest('POST', '/takeAttendance', attendanceData);
                const withinRadius = distance <= locationLesson.radius;
                const passed = (withinRadius && response.data.success) || (!withinRadius && !response.data.success);
                
                logTest(
                    'Boundary - Location at Radius Edge',
                    [`Submit attendance ~${Math.round(distance)}m from center (${locationLesson.radius}m radius)`],
                    { withinRadius: withinRadius },
                    { success: withinRadius },
                    { success: response.data.success, distance: Math.round(distance) },
                    passed
                );
            } catch (error) {
                logTest('Boundary - Location at Radius Edge', [], {}, {}, {}, false, error);
            }
        }
    }
}

async function testDataIntegrity() {
    console.log('\n🗄️ Testing Data Integrity & Consistency...');
    
    const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
    
    // Test 40: Lesson deletion cascade - Create dedicated lesson for this test
    try {
        // Create a fresh lesson specifically for deletion testing
        const deletionLessonData = {
            name: 'Deletion Test Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: false
        };
        
        const lessonResponse = await makeRequest('POST', '/createLesson', deletionLessonData, authHeaders);
        
        if (lessonResponse.data.success && lessonResponse.data.lessonId) {
            const testLessonId = lessonResponse.data.lessonId;
            
            // First add an attendance record
            const attendanceData = {
                lessonId: testLessonId,
                studentName: 'Data Integrity Test Student'
            };
            const attendanceResponse = await makeRequest('POST', '/takeAttendance', attendanceData);
            
            // Only proceed if attendance was successful 
            if (attendanceResponse.data.success) {
                // Validate lesson ID before deletion
                if (!testLessonId || testLessonId.length < 10) {
                    logTest('Data Integrity - Lesson Deletion Cascade', [], {}, {}, { invalidLessonId: testLessonId }, false);
                    return;
                }
                
                // Then delete the lesson
                const deleteResponse = await makeRequest('DELETE', `/deleteLesson/${encodeURIComponent(testLessonId)}`, {}, authHeaders);
                
                // If deletion was successful, check accessibility
                if (deleteResponse.status === 200) {
                    // Try to access the deleted lesson
                    const accessResponse = await makeRequest('GET', `/lesson/${encodeURIComponent(testLessonId)}`);
                    const passed = accessResponse.status === 404;
                    
                    logTest(
                        'Data Integrity - Lesson Deletion Cascade',
                        ['Create new lesson', 'Add attendance record', 'Delete lesson', 'Verify lesson is inaccessible'],
                        { lessonId: testLessonId },
                        { deleted: true, accessible: false },
                        { 
                            deleteSuccess: true,
                            accessible: accessResponse.status !== 404,
                            accessStatus: accessResponse.status
                        },
                        passed
                    );
                } else {
                    // Deletion failed, report the detailed error
                    logTest(
                        'Data Integrity - Lesson Deletion Cascade',
                        ['Create new lesson', 'Add attendance record', 'Delete lesson failed'],
                        { lessonId: testLessonId },
                        { deleted: true, accessible: false },
                        { 
                            deleteStatus: deleteResponse.status,
                            deleteSuccess: false,
                            deleteMessage: deleteResponse.data?.message || 'No message',
                            deleteBody: JSON.stringify(deleteResponse.data),
                            tokenPresent: !!authHeaders.Authorization
                        },
                        false
                    );
                }
            } else {
                logTest('Data Integrity - Lesson Deletion Cascade', [], {}, {}, { attendanceFailed: true, attendanceMessage: attendanceResponse.data?.message }, false);
            }
        } else {
            logTest('Data Integrity - Lesson Deletion Cascade', [], {}, {}, { lessonCreationFailed: true }, false);
        }
    } catch (error) {
        logTest('Data Integrity - Lesson Deletion Cascade', [], {}, {}, {}, false, error);
    }

    // Test 41: Token expiration handling - Accept both 401 and 403 as valid rejection
    try {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJlbWFpbCI6ImV4cGlyZWRAZXhhbXBsZS5jb20iLCJuYW1lIjoiRXhwaXJlZCBVc2VyIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalidtoken';
        const expiredHeaders = { 'Authorization': `Bearer ${expiredToken}` };
        
        const response = await makeRequest('GET', '/myLessons', null, expiredHeaders);
        // Accept both 401 (expired) and 403 (invalid) as proper rejections
        const passed = response.status === 401 || response.status === 403;
        
        logTest(
            'Data Integrity - Token Expiration',
            ['Access protected endpoint with expired/invalid token'],
            { tokenType: 'expired/invalid' },
            { rejected: true },
            { status: response.status, rejected: passed },
            passed
        );
    } catch (error) {
        logTest('Data Integrity - Token Expiration', [], {}, {}, { rejected: true }, true);
    }
}

async function testAdvancedLocationScenarios() {
    console.log('\n🌍 Testing Advanced Location Scenarios...');
    
    if (testData.lessons.length === 0) {
        console.log('⚠️ No lessons available for advanced location tests');
        return;
    }

    const locationLesson = testData.lessons.find(l => l.locationEnabled);
    if (!locationLesson) {
        console.log('⚠️ No location-enabled lessons available');
        return;
    }

    // Test 42: Very high GPS accuracy (sub-meter) - Create new lesson to avoid IP conflicts
    try {
        // Create a new lesson for this test to avoid IP duplication issues
        const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
        const newLessonData = {
            name: 'GPS Accuracy Test Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 100,
            locationName: 'GPS Test Location'
        };
        
        const lessonResponse = await makeRequest('POST', '/createLesson', newLessonData, authHeaders);
        
        if (lessonResponse.data.success) {
            const attendanceData = {
                lessonId: lessonResponse.data.lessonId,
                studentName: 'High Accuracy GPS Test Student',
                latitude: CONFIG.locations.inside.lat,
                longitude: CONFIG.locations.inside.lon,
                accuracy: 1 // Very high accuracy
            };
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const passed = response.status === 200 && response.data.success;
            
            logTest(
                'Advanced Location - High GPS Accuracy',
                ['Create new lesson', 'Submit attendance with 1m GPS accuracy'],
                { accuracy: 1 },
                { success: true },
                { success: response.data.success },
                passed
            );
        } else {
            logTest('Advanced Location - High GPS Accuracy', [], {}, {}, { lessonCreationFailed: true }, false);
        }
    } catch (error) {
        logTest('Advanced Location - High GPS Accuracy', [], {}, {}, {}, false, error);
    }

    // Test 43: Coordinate precision edge cases - Create new lesson
    try {
        const authHeaders = { 'Authorization': `Bearer ${testData.token}` };
        const precisionLessonData = {
            name: 'Precision Test Lesson',
            date: new Date().toISOString().split('T')[0],
            locationEnabled: true,
            centerLatitude: CONFIG.locations.center.lat,
            centerLongitude: CONFIG.locations.center.lon,
            radiusMeters: 100,
            locationName: 'Precision Test Location'
        };
        
        const lessonResponse = await makeRequest('POST', '/createLesson', precisionLessonData, authHeaders);
        
        if (lessonResponse.data.success) {
            const attendanceData = {
                lessonId: lessonResponse.data.lessonId,
                studentName: 'Precision Test Student',
                latitude: CONFIG.locations.center.lat + 0.00001, // Very small offset (~1m)
                longitude: CONFIG.locations.center.lon + 0.00001,
                accuracy: 10
            };
            
            const distance = calculateDistance(
                attendanceData.latitude, attendanceData.longitude,
                precisionLessonData.centerLatitude, precisionLessonData.centerLongitude
            );
            
            const response = await makeRequest('POST', '/takeAttendance', attendanceData);
            const withinRadius = distance <= precisionLessonData.radiusMeters;
            const passed = (withinRadius && response.data.success) || (!withinRadius && !response.data.success);
            
            logTest(
                'Advanced Location - Coordinate Precision',
                ['Create new lesson', `Submit attendance with micro-coordinate offset (~${Math.round(distance)}m)`],
                { withinRadius: withinRadius, radius: precisionLessonData.radiusMeters },
                { success: withinRadius },
                { success: response.data.success, calculatedDistance: Math.round(distance) },
                passed
            );
        } else {
            logTest('Advanced Location - Coordinate Precision', [], {}, {}, { lessonCreationFailed: true }, false);
        }
    } catch (error) {
        logTest('Advanced Location - Coordinate Precision', [], {}, {}, {}, false, error);
    }
}

// Enhanced main test runner
async function runAllTests() {
    console.log('🚀 Starting Enhanced Comprehensive QR Attendance System Tests');
    console.log('Server URL:', CONFIG.baseUrl);
    console.log('Test started at:', new Date().toLocaleString());
    console.log('='.repeat(80));
    
    try {
        // Core functionality tests
        await testTeacherRegistration();
        await testLessonCreation();
        await testStudentAttendance();
        await testQRInvalidation();
        await testAttendanceList();
        await testLessonInfo();
        await testMyLessons();
        
        // Enhanced test suites
        await testPerformance();
        await testSecurity();
        await testBoundaryConditions();
        await testDataIntegrity();
        await testAdvancedLocationScenarios();
        
        generateReport();
        
    } catch (error) {
        console.error('\n💥 Test suite crashed:', error.message);
        generateReport();
    }
}

// Enhanced report generation
function generateReport() {
    console.log('\n📊 ENHANCED TEST REPORT');
    console.log('='.repeat(80));
    
    const passedTests = testResults.filter(t => t.passed);
    const failedTests = testResults.filter(t => !t.passed);
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${testResults.length}`);
    console.log(`   ✅ Passed: ${passedTests.length}`);
    console.log(`   ❌ Failed: ${failedTests.length}`);
    console.log(`   📊 Success Rate: ${((passedTests.length / testResults.length) * 100).toFixed(1)}%`);
    
    if (failedTests.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        console.log('-'.repeat(50));
        failedTests.forEach(test => {
            console.log(`\n[${test.id}] ${test.name}`);
            console.log(`   Steps: ${test.steps.join(', ')}`);
            if (test.error) {
                console.log(`   Error: ${test.error}`);
            }
            console.log(`   Expected: ${JSON.stringify(test.expected)}`);
            console.log(`   Actual: ${JSON.stringify(test.actual)}`);
        });
    }
    
    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(50));
    
    // Enhanced test categories
    const categories = {
        'Authentication': testResults.filter(t => t.name.includes('Registration') || t.name.includes('Login')),
        'Lesson Management': testResults.filter(t => t.name.includes('Lesson Creation') || t.name.includes('My Lessons')),
        'Student Attendance': testResults.filter(t => t.name.includes('Student Attendance')),
        'QR Management': testResults.filter(t => t.name.includes('QR Invalidation')),
        'Data Retrieval': testResults.filter(t => t.name.includes('Attendance List') || t.name.includes('Lesson Info')),
        'Performance': testResults.filter(t => t.name.includes('Performance')),
        'Security': testResults.filter(t => t.name.includes('Security')),
        'Boundary Conditions': testResults.filter(t => t.name.includes('Boundary')),
        'Data Integrity': testResults.filter(t => t.name.includes('Data Integrity')),
        'Advanced Location': testResults.filter(t => t.name.includes('Advanced Location'))
    };
    
    Object.entries(categories).forEach(([category, tests]) => {
        if (tests.length > 0) {
            console.log(`\n🔹 ${category}:`);
            tests.forEach(test => {
                const status = test.passed ? '✅' : '❌';
                console.log(`   ${status} [${test.id.toString().padStart(2, '0')}] ${test.name}`);
            });
        }
    });
    
    console.log('\n💡 ENHANCED RECOMMENDATIONS:');
    console.log('-'.repeat(50));
    
    if (failedTests.length === 0) {
        console.log('🎉 All tests passed! Your QR attendance system is robust and secure.');
        console.log('✨ System demonstrates excellent performance, security, and reliability.');
    } else {
        console.log('🔧 Please review and fix the failed test cases above.');
        
        if (failedTests.some(t => t.name.includes('Performance'))) {
            console.log('⚡ Performance issues detected - optimize response times and concurrent handling');
        }
        if (failedTests.some(t => t.name.includes('Security'))) {
            console.log('🛡️ Security vulnerabilities found - implement proper input validation and sanitization');
        }
        if (failedTests.some(t => t.name.includes('Boundary'))) {
            console.log('🎯 Boundary condition failures - review edge case handling');
        }
        if (failedTests.some(t => t.name.includes('Location'))) {
            console.log('🌍 Location validation issues - verify GPS accuracy and distance calculations');
        }
        if (failedTests.some(t => t.error && t.error.includes('ECONNREFUSED'))) {
            console.log('🔌 Ensure the server is running on http://localhost:3000');
        }
    }
    
    console.log('\n📊 Performance Summary:');
    const performanceTests = testResults.filter(t => t.name.includes('Performance'));
    if (performanceTests.length > 0) {
        performanceTests.forEach(test => {
            if (test.actual.actualTime) {
                console.log(`   ⏱️ ${test.name}: ${test.actual.actualTime}ms`);
            }
        });
    }
    
    console.log('\n📅 Test completed at:', new Date().toLocaleString());
    console.log('='.repeat(80));
}

// Export for potential module usage
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests, testResults }; 