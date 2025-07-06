const http = require('http');
const https = require('https');

// Test configuration
const CONFIG = {
    baseUrl: 'http://localhost:3000',
    testTimeout: 10000,
    // Test locations for location-based tests
    locations: {
        center: { lat: 41.0082, lon: 28.9784 }, // Istanbul center
        inside: { lat: 41.0083, lon: 28.9785 }, // ~15m away
        outside: { lat: 41.0200, lon: 28.9900 }, // ~1.5km away
        faraway: { lat: 40.7589, lon: -73.9851 } // New York (~8000km away)
    }
};

// Test results storage
let testResults = [];
let testCounter = 0;

// Utility functions
function makeRequest(method, path, data = null, headers = {}) {
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
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
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

// Test data storage
let testData = {
    teacher: {
        name: 'Test Teacher',
        email: 'test@teacher.com',
        password: 'test123456'
    },
    token: null,
    lessons: []
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

// Test report generation
function generateReport() {
    console.log('\n📊 TEST REPORT');
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
    
    // Group tests by category
    const categories = {
        'Authentication': testResults.filter(t => t.name.includes('Registration') || t.name.includes('Login')),
        'Lesson Management': testResults.filter(t => t.name.includes('Lesson Creation') || t.name.includes('My Lessons')),
        'Student Attendance': testResults.filter(t => t.name.includes('Student Attendance')),
        'QR Management': testResults.filter(t => t.name.includes('QR Invalidation')),
        'Data Retrieval': testResults.filter(t => t.name.includes('Attendance List') || t.name.includes('Lesson Info'))
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
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(50));
    
    if (failedTests.length === 0) {
        console.log('🎉 All tests passed! Your QR attendance system is working correctly.');
    } else {
        console.log('🔧 Please review and fix the failed test cases above.');
        
        if (failedTests.some(t => t.name.includes('Authentication'))) {
            console.log('• Check user registration and login functionality');
        }
        if (failedTests.some(t => t.name.includes('Location'))) {
            console.log('• Review location validation logic and GPS accuracy handling');
        }
        if (failedTests.some(t => t.name.includes('Attendance'))) {
            console.log('• Verify attendance submission and validation rules');
        }
        if (failedTests.some(t => t.error && t.error.includes('ECONNREFUSED'))) {
            console.log('• Ensure the server is running on http://localhost:3000');
        }
    }
    
    console.log('\n📅 Test completed at:', new Date().toLocaleString());
    console.log('='.repeat(80));
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Comprehensive QR Attendance System Tests');
    console.log('Server URL:', CONFIG.baseUrl);
    console.log('Test started at:', new Date().toLocaleString());
    console.log('='.repeat(80));
    
    try {
        await testTeacherRegistration();
        await testLessonCreation();
        await testStudentAttendance();
        await testQRInvalidation();
        await testAttendanceList();
        await testLessonInfo();
        await testMyLessons();
        
        generateReport();
        
    } catch (error) {
        console.error('\n💥 Test suite crashed:', error.message);
        generateReport();
    }
}

// Export for potential module usage
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests, testResults }; 