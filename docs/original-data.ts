import {
  AnomalyReport,
  LibrarySeat,
  LibrarySpace,
  SpaceId,
} from '../types/library';

export const CURRENT_STUDENT = {
  name: '林知夏',
  studentId: 'B11204018',
  department: '建築與城鄉研究所',
};

export const LIBRARY_SPACES: Record<SpaceId, LibrarySpace> = {
  pavilion: {
    id: 'pavilion',
    name: '晨光木質靜讀室',
    englishSubtitle: 'Timber Reading Pavilion',
    seatCount: 12,
    floorAreaLabel: '148 m² · 2F 東翼',
    ambientDb: 34,
    lightingProfile: '自然漫射晨光 · 4000K 暖白',
    description:
      '以實木格柵與東向落地窗打造的高靜音個人研讀室，每個席位均配有獨立視線遮板與黃銅護眼檯燈。',
    atmosphereTags: ['34 dB 極靜', '個人木質單席', '東向自然採光'],
    accentHex: '#0F766E',
    cameras: [
      {
        id: 'CAM-P01',
        label: '靜讀室西側全景鏡',
        position: [-5.4, 3.6, -4.1],
        lookAt: [-1.5, 0.5, 0],
        fovDeg: 58,
      },
      {
        id: 'CAM-P02',
        label: '靜讀室東側窗景鏡',
        position: [5.4, 3.6, 4.1],
        lookAt: [1.5, 0.5, 0],
        fovDeg: 58,
      },
    ],
  },
  atrium: {
    id: 'atrium',
    name: '玻璃中庭協作廳',
    englishSubtitle: 'Atrium Glass Commons',
    seatCount: 16,
    floorAreaLabel: '215 m² · 3F 中央天井',
    ambientDb: 44,
    lightingProfile: '天窗採光水磨石中庭 · 4800K',
    description:
      '挑高玻璃天井下圍繞中島共享長桌與半開放玻璃隔間，支援筆記型電腦重度用電與雙螢幕工作流。',
    atmosphereTags: ['44 dB 輕協作', '雙螢幕研究席', '天窗自然光'],
    accentHex: '#1D4ED8',
    cameras: [
      {
        id: 'CAM-A01',
        label: '中庭北向俯瞰鏡',
        position: [-5.8, 3.9, -4.6],
        lookAt: [0, 0.5, 0],
        fovDeg: 62,
      },
      {
        id: 'CAM-A02',
        label: '中庭南向席位鏡',
        position: [5.8, 3.9, 4.6],
        lookAt: [0, 0.5, 0],
        fovDeg: 62,
      },
    ],
  },
  loft: {
    id: 'loft',
    name: '星空階梯沉浸閣',
    englishSubtitle: 'Terraced Nocturne Loft',
    seatCount: 20,
    floorAreaLabel: '268 m² · 4F 錯層夾層',
    ambientDb: 38,
    lightingProfile: '建築間接漫射光 · 可調色溫閱讀燈',
    description:
      '雙層錯落平台結合人體工學深桌與上層夾層眺望席，提供低干擾的長時段論文寫作與程式開發環境。',
    atmosphereTags: ['38 dB 專注艙', '雙層錯落平台', '全席 PD 快充'],
    accentHex: '#4338CA',
    cameras: [
      {
        id: 'CAM-L01',
        label: '下層研究區攝影機',
        position: [-6.4, 3.8, -4.8],
        lookAt: [-2.0, 0.4, 0],
        fovDeg: 60,
      },
      {
        id: 'CAM-L02',
        label: '上層夾層挑高攝影機',
        position: [6.5, 5.2, 4.8],
        lookAt: [4.6, 1.8, -0.5],
        fovDeg: 56,
      },
    ],
  },
};

export function createInitialSeats(): LibrarySeat[] {
  const pavilionSeats: LibrarySeat[] = [
    // Window row (x = -4.3, facing -X toward window)
    {
      id: 'P-01',
      code: 'P-01',
      spaceId: 'pavilion',
      position: { x: -4.2, y: 0, z: -3.0, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: true,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 105,
        noiseDb: 33,
        illuminanceLux: 620,
        zoneLabel: '東向窗景單人座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 98,
        lastUpdated: '14:12:08',
      },
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-02',
      code: 'P-02',
      spaceId: 'pavilion',
      position: { x: -4.2, y: 0, z: -1.0, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: true,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 105,
        noiseDb: 33,
        illuminanceLux: 640,
        zoneLabel: '東向窗景單人座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: true,
        hasBackpack: true,
        hasBooks: true,
        confidence: 97,
        lastUpdated: '14:12:10',
      },
      reservation: {
        id: 'RES-2026-081',
        studentName: '陳映彤',
        studentId: 'B11102044',
        isCurrentUser: false,
        date: '2026-11-17',
        timeSlot: '13:00 – 17:00 下午時段（目前）',
        checkedInAt: '13:08',
      },
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-03',
      code: 'P-03',
      spaceId: 'pavilion',
      position: { x: -4.2, y: 0, z: 1.0, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: true,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 105,
        noiseDb: 34,
        illuminanceLux: 610,
        zoneLabel: '東向窗景單人座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: false,
        hasBackpack: true,
        hasBooks: true,
        confidence: 95,
        lastUpdated: '14:11:45',
      },
      // 暫離範例：有預約、無人、有書包和書本 -> 暫離保留中
      reservation: {
        id: 'RES-2026-082',
        studentName: '吳柏諺',
        studentId: 'B11009012',
        isCurrentUser: false,
        date: '2026-11-17',
        timeSlot: '13:00 – 17:00 下午時段（目前）',
        checkedInAt: '13:15',
        tempAwaySince: '13:58',
      },
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-04',
      code: 'P-04',
      spaceId: 'pavilion',
      position: { x: -4.2, y: 0, z: 3.0, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: true,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 105,
        noiseDb: 34,
        illuminanceLux: 590,
        zoneLabel: '東向窗景單人座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 99,
        lastUpdated: '14:12:02',
      },
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    // Center oak cluster (x = -0.2 & x = 1.1? No, pair back-to-back or single column)
    // Let's make 2 neat rows facing -X / +X with wide aisle
    {
      id: 'P-05',
      code: 'P-05',
      spaceId: 'pavilion',
      position: { x: -0.6, y: 0, z: -2.6, rotationY: Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V 雙孔',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: false,
        ultraQuiet: true,
        deskWidthCm: 95,
        noiseDb: 34,
        illuminanceLux: 510,
        zoneLabel: '中區木質靜讀座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: true,
        hasBackpack: true,
        hasBooks: false,
        confidence: 94,
        lastUpdated: '14:12:04',
      },
      // 問題1核心示範：無預約但攝影機偵測到人與背包 -> 占用異常・暫停預約！
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-06',
      code: 'P-06',
      spaceId: 'pavilion',
      position: { x: -0.6, y: 0, z: -0.8, rotationY: Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V 雙孔',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: false,
        ultraQuiet: true,
        deskWidthCm: 95,
        noiseDb: 34,
        illuminanceLux: 500,
        zoneLabel: '中區木質靜讀座',
      },
      vision: {
        cameraId: 'CAM-P01',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 98,
        lastUpdated: '14:12:00',
      },
      // 目前學生帳號林知夏的預約席位（待入席，可測試到席／暫離／或回報被他人占用！）
      reservation: {
        id: 'RES-2026-099',
        studentName: CURRENT_STUDENT.name,
        studentId: CURRENT_STUDENT.studentId,
        isCurrentUser: true,
        date: '2026-11-17',
        timeSlot: '13:00 – 17:00 下午時段（目前）',
      },
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-07',
      code: 'P-07',
      spaceId: 'pavilion',
      position: { x: -0.6, y: 0, z: 1.0, rotationY: Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V 雙孔',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: false,
        ultraQuiet: true,
        deskWidthCm: 95,
        noiseDb: 35,
        illuminanceLux: 505,
        zoneLabel: '中區木質靜讀座',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 98,
        lastUpdated: '14:11:55',
      },
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-08',
      code: 'P-08',
      spaceId: 'pavilion',
      position: { x: -0.6, y: 0, z: 2.8, rotationY: Math.PI / 2 },
      specs: {
        powerOutlet: false,
        outletType: '無插座（純閱讀）',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: false,
        ultraQuiet: true,
        deskWidthCm: 90,
        noiseDb: 34,
        illuminanceLux: 495,
        zoneLabel: '中區純閱讀木座',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: true,
        hasBackpack: false,
        hasBooks: true,
        confidence: 96,
        lastUpdated: '14:12:07',
      },
      reservation: {
        id: 'RES-2026-083',
        studentName: '張語宸',
        studentId: 'B11207031',
        isCurrentUser: false,
        date: '2026-11-17',
        timeSlot: '13:00 – 17:00 下午時段（目前）',
        checkedInAt: '13:22',
      },
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    // Right cluster (x = 3.4, facing -X)
    {
      id: 'P-09',
      code: 'P-09',
      spaceId: 'pavilion',
      position: { x: 3.4, y: 0, z: -2.6, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 100,
        noiseDb: 33,
        illuminanceLux: 520,
        zoneLabel: '書架側靜讀席',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 99,
        lastUpdated: '14:12:01',
      },
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-10',
      code: 'P-10',
      spaceId: 'pavilion',
      position: { x: 3.4, y: 0, z: -0.8, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 100,
        noiseDb: 33,
        illuminanceLux: 525,
        zoneLabel: '書架側靜讀席',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: true,
        confidence: 92,
        lastUpdated: '14:10:40',
      },
      // 無預約卻留有書籍佔位 -> 異常
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-11',
      code: 'P-11',
      spaceId: 'pavilion',
      position: { x: 3.4, y: 0, z: 1.0, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 100,
        noiseDb: 34,
        illuminanceLux: 515,
        zoneLabel: '書架側靜讀席',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: true,
        hasBackpack: true,
        hasBooks: true,
        confidence: 98,
        lastUpdated: '14:12:09',
      },
      reservation: {
        id: 'RES-2026-084',
        studentName: '黃子軒',
        studentId: 'R11322005',
        isCurrentUser: false,
        date: '2026-11-17',
        timeSlot: '13:00 – 17:00 下午時段（目前）',
        checkedInAt: '13:04',
      },
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    },
    {
      id: 'P-12',
      code: 'P-12',
      spaceId: 'pavilion',
      position: { x: 3.4, y: 0, z: 2.8, rotationY: -Math.PI / 2 },
      specs: {
        powerOutlet: true,
        outletType: '110V + USB-C 65W',
        dualMonitor: false,
        deskLamp: true,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: true,
        deskWidthCm: 100,
        noiseDb: 34,
        illuminanceLux: 510,
        zoneLabel: '書架側靜讀席',
      },
      vision: {
        cameraId: 'CAM-P02',
        hasPerson: false,
        hasBackpack: false,
        hasBooks: false,
        confidence: 99,
        lastUpdated: '14:12:05',
      },
      reservation: null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: true,
      lockReason: '黃銅檯燈調光旋鈕檢修中',
    },
  ];

  const atriumSeats: LibrarySeat[] = [
    // Central 6-seat island table (A-01 to A-06)
    ...[-2.1, 0, 2.1].map((x, idx) => ({
      id: `A-0${idx + 1}`,
      code: `A-0${idx + 1}`,
      spaceId: 'atrium' as SpaceId,
      position: { x, y: 0, z: -0.95, rotationY: 0 },
      specs: {
        powerOutlet: true,
        outletType: '地插 110V + PD 100W',
        dualMonitor: idx === 1,
        deskLamp: false,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: false,
        deskWidthCm: 120,
        noiseDb: 45,
        illuminanceLux: 680,
        zoneLabel: '中庭共享長桌北側',
      },
      vision: {
        cameraId: 'CAM-A01',
        hasPerson: idx === 0,
        hasBackpack: idx === 0 || idx === 2,
        hasBooks: idx === 0 || idx === 2,
        confidence: 96,
        lastUpdated: '14:12:06',
      },
      reservation:
        idx === 0
          ? {
              id: 'RES-2026-102',
              studentName: '李宥安',
              studentId: 'B11201055',
              isCurrentUser: false,
              date: '2026-11-17',
              timeSlot: '13:00 – 17:00 下午時段（目前）',
              checkedInAt: '13:18',
            }
          : idx === 2
            ? {
                id: 'RES-2026-103',
                studentName: '許雅筑',
                studentId: 'B11103019',
                isCurrentUser: false,
                date: '2026-11-17',
                timeSlot: '13:00 – 17:00 下午時段（目前）',
                checkedInAt: '13:10',
                tempAwaySince: '14:04',
              }
            : null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    })),
    ...[-2.1, 0, 2.1].map((x, idx) => ({
      id: `A-0${idx + 4}`,
      code: `A-0${idx + 4}`,
      spaceId: 'atrium' as SpaceId,
      position: { x, y: 0, z: 0.95, rotationY: Math.PI },
      specs: {
        powerOutlet: true,
        outletType: '地插 110V + PD 100W',
        dualMonitor: idx === 1,
        deskLamp: false,
        windowView: false,
        ergonomicChair: true,
        ultraQuiet: false,
        deskWidthCm: 120,
        noiseDb: 45,
        illuminanceLux: 675,
        zoneLabel: '中庭共享長桌南側',
      },
      vision: {
        cameraId: 'CAM-A02',
        hasPerson: idx === 1,
        hasBackpack: idx === 1,
        hasBooks: idx === 1,
        confidence: 97,
        lastUpdated: '14:12:08',
      },
      reservation:
        idx === 1
          ? {
              id: 'RES-2026-104',
              studentName: '林冠廷',
              studentId: 'R11292114',
              isCurrentUser: false,
              date: '2026-11-17',
              timeSlot: '13:00 – 17:00 下午時段（目前）',
              checkedInAt: '13:02',
            }
          : null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    })),
    // Rear glass booths (A-07 to A-10)
    ...[-3.4, -1.5, 1.5, 3.4].map((x, idx) => {
      const codeNum = idx + 7;
      const code = codeNum < 10 ? `A-0${codeNum}` : `A-${codeNum}`;
      const isOccupiedAnomaly = idx === 2;
      return {
        id: code,
        code,
        spaceId: 'atrium' as SpaceId,
        position: { x, y: 0, z: -3.5, rotationY: 0 },
        specs: {
          powerOutlet: true,
          outletType: '110V + USB-C 65W',
          dualMonitor: true,
          deskLamp: true,
          windowView: false,
          ergonomicChair: true,
          ultraQuiet: false,
          deskWidthCm: 115,
          noiseDb: 41,
          illuminanceLux: 590,
          zoneLabel: '玻璃半開放隔間席',
        },
        vision: {
          cameraId: 'CAM-A01',
          hasPerson: isOccupiedAnomaly || idx === 0,
          hasBackpack: isOccupiedAnomaly || idx === 0,
          hasBooks: idx === 0,
          confidence: 95,
          lastUpdated: '14:11:58',
        },
        reservation:
          idx === 0
            ? {
                id: 'RES-2026-105',
                studentName: '周品妤',
                studentId: 'B11205008',
                isCurrentUser: false,
                date: '2026-11-17',
                timeSlot: '13:00 – 17:00 下午時段（目前）',
                checkedInAt: '13:30',
              }
            : null,
        hasActiveAnomalyReport: isOccupiedAnomaly,
        isLockedByAdmin: false,
      };
    }),
    // Front window focus bar (A-11 to A-14)
    ...[-3.6, -1.2, 1.2, 3.6].map((x, idx) => {
      const code = `A-${idx + 11}`;
      return {
        id: code,
        code,
        spaceId: 'atrium' as SpaceId,
        position: { x, y: 0, z: 3.7, rotationY: Math.PI },
        specs: {
          powerOutlet: true,
          outletType: '110V + USB-C 65W',
          dualMonitor: false,
          deskLamp: true,
          windowView: true,
          ergonomicChair: true,
          ultraQuiet: false,
          deskWidthCm: 100,
          noiseDb: 43,
          illuminanceLux: 720,
          zoneLabel: '南向玻璃窗景吧台席',
        },
        vision: {
          cameraId: 'CAM-A02',
          hasPerson: idx === 3,
          hasBackpack: idx === 3,
          hasBooks: idx === 3,
          confidence: 98,
          lastUpdated: '14:12:03',
        },
        reservation:
          idx === 3
            ? {
                id: 'RES-2026-106',
                studentName: '鄭宇翔',
                studentId: 'B11108027',
                isCurrentUser: false,
                date: '2026-11-17',
                timeSlot: '13:00 – 17:00 下午時段（目前）',
                checkedInAt: '13:12',
              }
            : null,
      hasActiveAnomalyReport: false,
      isLockedByAdmin: false,
    };
  }),
    // Right dual-monitor creative pods (A-15, A-16)
    ...[-1.3, 1.3].map((z, idx) => {
      const code = `A-${idx + 15}`;
      return {
        id: code,
        code,
        spaceId: 'atrium' as SpaceId,
        position: { x: 4.9, y: 0, z, rotationY: -Math.PI / 2 },
        specs: {
          powerOutlet: true,
          outletType: '110V + PD 100W + HDMI',
          dualMonitor: true,
          deskLamp: true,
          windowView: true,
          ergonomicChair: true,
          ultraQuiet: false,
          deskWidthCm: 135,
          noiseDb: 42,
          illuminanceLux: 650,
          zoneLabel: '雙螢幕建築設計席',
        },
        vision: {
          cameraId: 'CAM-A02',
          hasPerson: false,
          hasBackpack: false,
          hasBooks: false,
          confidence: 99,
          lastUpdated: '14:12:08',
        },
        reservation: null,
        hasActiveAnomalyReport: false,
        isLockedByAdmin: false,
      };
    }),
  ];

  // Loft: 20 seats (12 lower deck + 8 mezzanine upper deck)
  const loftSeats: LibrarySeat[] = [];
  const lowerRowsZ = [-2.9, 0.0, 2.9];
  const lowerColsX = [-4.9, -2.7, -0.5, 1.7];
  let loftIdx = 1;

  lowerRowsZ.forEach((z, rIdx) => {
    lowerColsX.forEach((x, cIdx) => {
      const code = `L-${loftIdx < 10 ? '0' + loftIdx : loftIdx}`;
      const isCheckedIn =
        (rIdx === 0 && cIdx === 0) ||
        (rIdx === 1 && cIdx === 2) ||
        (rIdx === 2 && cIdx === 1);
      const isTempAway = rIdx === 0 && cIdx === 2;
      const isUnbookedAnomaly = rIdx === 1 && cIdx === 0;

      loftSeats.push({
        id: code,
        code,
        spaceId: 'loft',
        position: { x, y: 0, z, rotationY: Math.PI, floorLevel: 0 },
        specs: {
          powerOutlet: true,
          outletType: '110V + USB-C 100W',
          dualMonitor: cIdx < 2,
          deskLamp: true,
          windowView: cIdx === 0,
          ergonomicChair: true,
          ultraQuiet: true,
          deskWidthCm: 120,
          noiseDb: 37,
          illuminanceLux: 540,
          zoneLabel: '下層深桌研究艙',
        },
        vision: {
          cameraId: 'CAM-L01',
          hasPerson: isCheckedIn || isUnbookedAnomaly,
          hasBackpack: isCheckedIn || isTempAway || isUnbookedAnomaly,
          hasBooks: isCheckedIn || isTempAway,
          confidence: 96,
          lastUpdated: '14:12:04',
        },
        reservation: isCheckedIn
          ? {
              id: `RES-2026-2${loftIdx}`,
              studentName: ['葉書瑋', '謝佳穎', '邱致遠'][loftIdx % 3],
              studentId: `R112400${10 + loftIdx}`,
              isCurrentUser: false,
              date: '2026-11-17',
              timeSlot: '13:00 – 17:00 下午時段（目前）',
              checkedInAt: '13:05',
            }
          : isTempAway
            ? {
                id: `RES-2026-2${loftIdx}`,
                studentName: '曾柏翰',
                studentId: 'B11006022',
                isCurrentUser: false,
                date: '2026-11-17',
                timeSlot: '13:00 – 17:00 下午時段（目前）',
                checkedInAt: '13:11',
                tempAwaySince: '13:55',
              }
            : null,
        hasActiveAnomalyReport: false,
        isLockedByAdmin: false,
      });
      loftIdx++;
    });
  });

  // Mezzanine upper deck (8 seats: L-13 to L-20, elevated at y = 1.65)
  const upperColsX = [4.0, 5.9];
  const upperRowsZ = [-3.3, -1.2, 0.9, 3.0];
  upperColsX.forEach((x, cIdx) => {
    upperRowsZ.forEach((z, rIdx) => {
      const code = `L-${loftIdx}`;
      const isOccupied = cIdx === 1 && rIdx === 1;
      const isReservedWaiting = cIdx === 0 && rIdx === 0;
      loftSeats.push({
        id: code,
        code,
        spaceId: 'loft',
        position: {
          x,
          y: 1.65,
          z,
          rotationY: -Math.PI / 2,
          floorLevel: 1,
        },
        specs: {
          powerOutlet: true,
          outletType: '110V + USB-C 100W',
          dualMonitor: cIdx === 1,
          deskLamp: true,
          windowView: cIdx === 0,
          ergonomicChair: true,
          ultraQuiet: true,
          deskWidthCm: 115,
          noiseDb: 35,
          illuminanceLux: 520,
          zoneLabel: '上層夾層眺望席',
        },
        vision: {
          cameraId: 'CAM-L02',
          hasPerson: isOccupied,
          hasBackpack: isOccupied,
          hasBooks: isOccupied,
          confidence: 97,
          lastUpdated: '14:12:07',
        },
        reservation: isOccupied
          ? {
              id: `RES-2026-3${loftIdx}`,
              studentName: '蔡承翰',
              studentId: 'B11209041',
              isCurrentUser: false,
              date: '2026-11-17',
              timeSlot: '13:00 – 17:00 下午時段（目前）',
              checkedInAt: '13:19',
            }
          : isReservedWaiting
            ? {
                id: `RES-2026-3${loftIdx}`,
                studentName: '蘇郁婷',
                studentId: 'B11105013',
                isCurrentUser: false,
                date: '2026-11-17',
                timeSlot: '13:00 – 17:00 下午時段（目前）',
              }
            : null,
        hasActiveAnomalyReport: false,
        isLockedByAdmin: false,
      });
      loftIdx++;
    });
  });

  return [...pavilionSeats, ...atriumSeats, ...loftSeats];
}

export function createInitialReports(): AnomalyReport[] {
  return [
    {
      id: 'RPT-2026-041',
      seatId: 'A-09',
      seatCode: 'A-09',
      spaceId: 'atrium',
      spaceName: '玻璃中庭協作廳',
      reporterName: '林知夏',
      reporterId: CURRENT_STUDENT.studentId,
      isCurrentUser: true,
      issueType: 'seat_occupied_by_other',
      description: '上午預約該席時發現現場已有同學入座並放置筆電，已請求館員協助確認或換位。',
      createdAt: '13:42',
      stage: 'inspecting',
      librarianNote: '值班館員已收到通知，正在前往 3F 玻璃中庭查驗並提供替代座位建議。',
      timeline: [
        {
          stage: 'submitted',
          label: '異常回報已受理・席位暫停新預約',
          time: '13:42',
          detail: '系統已自動凍結 A-09 預約權限，並同步產生 3 個推薦替代座位。',
        },
        {
          stage: 'inspecting',
          label: '館員現場查驗中',
          time: '13:45',
          detail: '值班館員（張館員）已接單前往 3F 玻璃隔間區核對。',
        },
      ],
    },
    {
      id: 'RPT-2026-039',
      seatId: 'P-10',
      seatCode: 'P-10',
      spaceId: 'pavilion',
      spaceName: '晨光木質靜讀室',
      reporterName: '系統視覺偵測',
      reporterId: 'CAM-P02',
      isCurrentUser: false,
      issueType: 'items_left_unbooked',
      description: '無預約紀錄但攝影機持續偵測到桌面留有書籍物品超過 15 分鐘。',
      createdAt: '13:56',
      stage: 'submitted',
      timeline: [
        {
          stage: 'submitted',
          label: '系統偵測占用異常・自動暫停預約',
          time: '13:56',
          detail: 'CAM-P02 偵測無預約席位有書籍滯留，待館員現場巡檢確認。',
        },
      ],
    },
  ];
}
