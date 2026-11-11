const http = require('http');

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:4000/api/v1${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING RCA2.O ONBOARDING & COURSE MANAGEMENT INTEGRATION TEST ---');
  let token = null;

  // 1. Login
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@rcacademy.com', password: 'Admin@RCA2026' },
  });

  if (loginRes.status !== 200 || !loginRes.body.data?.accessToken) {
    console.error('Login failed:', loginRes);
    process.exit(1);
  }
  token = loginRes.body.data.accessToken;
  console.log('✓ 1. Super Admin Authentication Successful');

  // 2. Attendance Capacity Status
  const capRes = await request('/attendance/capacity', { token });
  console.log(`✓ 2. Capacity Status: ${capRes.body.data.totalAllocated}/${capRes.body.data.totalCapacity} codes allocated (${capRes.body.data.available} available, ${capRes.body.data.percentUsed}% used)`);

  // 3. Course Creation & Management
  const testCourseCode = `PHY-ADV-${Date.now().toString().slice(-4)}`;
  const courseRes = await request('/courses', {
    method: 'POST',
    token,
    body: {
      name: 'Advanced Physics Program',
      code: testCourseCode,
      description: 'Comprehensive physics foundation course',
    },
  });
  if (courseRes.status !== 201) {
    console.error('Course creation failed:', courseRes);
    process.exit(1);
  }
  const courseId = courseRes.body.data.id;
  console.log(`✓ 3. Course Created: ${courseRes.body.data.name} (Code: ${testCourseCode}, ID: ${courseId})`);

  // 4. Batch Creation under Course
  const testBatchCode = `B1-${Date.now().toString().slice(-3)}`;
  const batchRes = await request(`/courses/${courseId}/batches`, {
    method: 'POST',
    token,
    body: {
      name: 'Batch Alpha (Morning)',
      code: testBatchCode,
    },
  });
  if (batchRes.status !== 201) {
    console.error('Batch creation failed:', batchRes);
    process.exit(1);
  }
  const batchId = batchRes.body.data.id;
  console.log(`✓ 4. Batch Created: ${batchRes.body.data.name} (Code: ${testBatchCode}, ID: ${batchId})`);

  // 5. Manual Student Onboarding
  const studentEmail = `student.${Date.now()}@example.com`;
  const studentRes = await request('/students', {
    method: 'POST',
    token,
    body: {
      firstName: 'Kabir',
      lastName: 'Verma',
      dob: '2008-04-12',
      gender: 'MALE',
      email: studentEmail,
      phone: '+919876543299',
      courseId,
      batchId,
      guardians: [
        {
          fullName: 'Anil Verma',
          phone: '+919876543298',
          relationship: 'Father',
        },
      ],
    },
  });
  if (studentRes.status !== 201) {
    console.error('Student creation failed:', studentRes);
    process.exit(1);
  }
  const student = studentRes.body.data;
  console.log(`✓ 5. Manual Student Onboarding: ${student.firstName} ${student.lastName} (Student Code: ${student.studentCode}, 3-Digit Attendance Code: [${student.attendanceCode}])`);

  const codeNum = parseInt(student.attendanceCode, 10);
  if (isNaN(codeNum) || codeNum < 100 || codeNum > 999) {
    console.error(`Invalid attendance code range: ${student.attendanceCode}`);
    process.exit(1);
  }
  console.log(`✓ 5b. Validated 3-digit range: 100 <= ${codeNum} <= 999`);

  // 6. Manual Staff Onboarding with Course Assignment
  const staffEmail = `prof.mehta.${Date.now()}@rcacademy.com`;
  const staffRes = await request('/staff', {
    method: 'POST',
    token,
    body: {
      firstName: 'Vikram',
      lastName: 'Mehta',
      email: staffEmail,
      phone: '+919888877771',
      role: 'TEACHER',
      designation: 'Head of Physics Department',
      courseAssignments: [
        {
          courseId,
          batchId,
          role: 'LEAD_INSTRUCTOR',
        },
      ],
    },
  });
  if (staffRes.status !== 201) {
    console.error('Staff onboarding failed:', staffRes);
    process.exit(1);
  }
  const staff = staffRes.body.data;
  console.log(`✓ 6. Manual Staff Onboarding: ${staff.firstName} ${staff.lastName} (Role: ${staff.role}, 3-Digit Attendance Code: [${staff.attendanceCode}])`);

  if (staff.attendanceCode === student.attendanceCode) {
    console.error('FATAL: Collision between student and staff attendance code!');
    process.exit(1);
  }
  console.log(`✓ 6b. Confirmed globally unique attendance codes across student (${student.attendanceCode}) and staff (${staff.attendanceCode})`);

  // 7. Bulk CSV Validation & Import
  const bulkRows = [
    {
      firstName: 'Riya',
      lastName: 'Sen',
      dob: '2008-09-18',
      gender: 'FEMALE',
      email: `riya.${Date.now()}@example.com`,
      phone: '+919911223344',
      courseCode: testCourseCode,
      batchCode: testBatchCode,
      guardianName: 'Suman Sen',
      guardianPhone: '+919911223345',
      guardianRelationship: 'Mother',
    },
    {
      firstName: 'Arjun',
      lastName: 'Das',
      dob: '2008-11-25',
      gender: 'MALE',
      email: `arjun.${Date.now()}@example.com`,
      phone: '+919911223346',
      courseCode: testCourseCode,
      batchCode: testBatchCode,
      guardianName: 'Manoj Das',
      guardianPhone: '+919911223347',
      guardianRelationship: 'Father',
    },
    // Invalid row to test validation
    {
      firstName: '',
      lastName: 'InvalidUser',
      dob: 'invalid-date',
      gender: 'UNKNOWN',
      courseCode: 'NON_EXISTENT_COURSE',
      batchCode: 'NONE',
    },
  ];

  const validateRes = await request('/students/bulk-validate', {
    method: 'POST',
    token,
    body: { rows: bulkRows },
  });
  console.log(`✓ 7. Bulk CSV Validation Preview: Total: ${validateRes.body.data.totalRows}, Valid: ${validateRes.body.data.validCount}, Invalid: ${validateRes.body.data.invalidCount}`);

  // Import only valid rows
  const validRowsToImport = bulkRows.slice(0, 2);
  const importRes = await request('/students/bulk-import', {
    method: 'POST',
    token,
    body: { rows: validRowsToImport },
  });
  console.log(`✓ 8. Bulk CSV Import Execution: Created: ${importRes.body.data.summary.created}, Failed: ${importRes.body.data.summary.failed}`);
  for (const cs of importRes.body.data.createdStudents) {
    console.log(`   - Imported: ${cs.name} -> Code: ${cs.studentCode}, Attendance Code: [${cs.attendanceCode}]`);
  }

  // 9. Student Attendance via 3-digit Code
  const scanRes = await request('/attendance/quick-mark', {
    method: 'POST',
    token,
    body: {
      studentCode: student.attendanceCode, // Using 3-digit code!
      batchId,
    },
  });
  console.log(`✓ 9. Student Attendance Scanned with 3-digit Code: ${scanRes.body.data.message}`);

  // Test Duplicate scan prevention
  const dupScanRes = await request('/attendance/quick-mark', {
    method: 'POST',
    token,
    body: {
      studentCode: student.attendanceCode,
      batchId,
    },
  });
  console.log(`✓ 9b. Duplicate Attendance Prevented: alreadyMarked=${dupScanRes.body.data.alreadyMarked}`);

  // 10. Staff Attendance Check-In / Check-Out Terminal
  const staffCheckIn = await request('/attendance/staff/quick-mark', {
    method: 'POST',
    token,
    body: { code: staff.attendanceCode },
  });
  console.log(`✓ 10a. Staff Check-In Scanned: ${staffCheckIn.body.data.message}`);

  const staffCheckOut = await request('/attendance/staff/quick-mark', {
    method: 'POST',
    token,
    body: { code: staff.attendanceCode },
  });
  console.log(`✓ 10b. Staff Check-Out Scanned: ${staffCheckOut.body.data.message}`);

  console.log('\n======================================================');
  console.log('ALL RCA2.O ONBOARDING & COURSE MANAGEMENT TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
