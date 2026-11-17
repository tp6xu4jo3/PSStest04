export const SEAT_STATUS_META = {
    available: {
        status: 'available',
        label: '空位可預約',
        shortLabel: '可預約',
        description: '系統無預約且攝影機未偵測到人員或物品，可立即預約入座。',
        colorHex: '#059669',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-200',
        isBookable: true,
        isAnomaly: false,
    },
    reserved_waiting: {
        status: 'reserved_waiting',
        label: '已預約待入席',
        shortLabel: '待入席',
        description: '此席位已有有效預約，尚未偵測到預約者入席。',
        colorHex: '#0284C7',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-800',
        borderClass: 'border-sky-200',
        isBookable: false,
        isAnomaly: false,
    },
    occupied_checked_in: {
        status: 'occupied_checked_in',
        label: '已到席使用中',
        shortLabel: '使用中',
        description: '預約紀錄有效且攝影機偵測到現場人員入座（偵測無法驗證身分）。',
        colorHex: '#334155',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-800',
        borderClass: 'border-slate-300',
        isBookable: false,
        isAnomaly: false,
    },
    temp_away: {
        status: 'temp_away',
        label: '暫離保留中',
        shortLabel: '暫離',
        description: '預約者暫時離席但桌面留有個人物品，系統持續保留預約不自動取消。',
        colorHex: '#D97706',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-200',
        isBookable: false,
        isAnomaly: false,
    },
    anomaly_unbooked_occupied: {
        status: 'anomaly_unbooked_occupied',
        label: '占用異常・暫停預約',
        shortLabel: '占用異常',
        description: '系統顯示無預約，但攝影機偵測到現場有人員或個人物品占座，已暫停新預約待館員確認。',
        colorHex: '#DC2626',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-200',
        isBookable: false,
        isAnomaly: true,
    },
    anomaly_reported: {
        status: 'anomaly_reported',
        label: '異常回報凍結中',
        shortLabel: '回報凍結',
        description: '已收到現場衝突或設備異常回報，暫停新預約並交由館員現場查驗處理。',
        colorHex: '#B91C1C',
        bgClass: 'bg-red-50',
        textClass: 'text-red-900',
        borderClass: 'border-red-300',
        isBookable: false,
        isAnomaly: true,
    },
    maintenance: {
        status: 'maintenance',
        label: '館員暫停開放',
        shortLabel: '維護中',
        description: '館員手動鎖定此席位進行清潔或設備檢修。',
        colorHex: '#64748B',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-700',
        borderClass: 'border-stone-300',
        isBookable: false,
        isAnomaly: false,
    },
};
export function computeSeatStatus(seat) {
    if (seat.isLockedByAdmin) {
        return 'maintenance';
    }
    if (seat.hasActiveAnomalyReport) {
        return 'anomaly_reported';
    }
    const hasReservation = seat.reservation !== null;
    const { hasPerson, hasBackpack, hasBooks } = seat.vision;
    const hasAnyItem = hasBackpack || hasBooks;
    if (hasReservation) {
        if (hasPerson) {
            return 'occupied_checked_in';
        }
        if (hasAnyItem) {
            // 暫離保留：有預約、無人但有物品（不自動取消預約）
            return 'temp_away';
        }
        return 'reserved_waiting';
    }
    else {
        if (hasPerson || hasAnyItem) {
            // 系統無預約，但攝影機偵測到人或物品 -> 占用異常，暫停新預約
            return 'anomaly_unbooked_occupied';
        }
        return 'available';
    }
}
export function seatMatchesFilter(seat, filter) {
    const status = computeSeatStatus(seat);
    if (filter.onlyAvailable && status !== 'available') {
        return false;
    }
    const keys = Object.keys(filter.equipment);
    for (const key of keys) {
        if (filter.equipment[key] && !seat.specs[key]) {
            return false;
        }
    }
    if (filter.searchQuery.trim()) {
        const q = filter.searchQuery.trim().toLowerCase();
        const matchCode = seat.code.toLowerCase().includes(q);
        const matchZone = seat.specs.zoneLabel.toLowerCase().includes(q);
        const matchOutlet = seat.specs.outletType.toLowerCase().includes(q);
        if (!matchCode && !matchZone && !matchOutlet) {
            return false;
        }
    }
    return true;
}
export function findAlternativeSeats(referenceSeat, allSeats, preferredEquipment, limit = 3) {
    const candidates = allSeats.filter((seat) => {
        if (referenceSeat && seat.id === referenceSeat.id)
            return false;
        return computeSeatStatus(seat) === 'available';
    });
    const scored = candidates.map((seat) => {
        let score = 50;
        const reasons = [];
        if (referenceSeat) {
            if (seat.spaceId === referenceSeat.spaceId) {
                score += 24;
                reasons.push('同自習空間免跨區移動');
            }
            const dbDiff = Math.abs(seat.specs.noiseDb - referenceSeat.specs.noiseDb);
            if (dbDiff <= 3) {
                score += 10;
                reasons.push(`相近安靜度 (${seat.specs.noiseDb} dB)`);
            }
            if (referenceSeat.specs.dualMonitor && seat.specs.dualMonitor) {
                score += 18;
                reasons.push('配備雙螢幕延伸座');
            }
            if (referenceSeat.specs.windowView && seat.specs.windowView) {
                score += 12;
                reasons.push('靠窗自然採光');
            }
            if (referenceSeat.specs.powerOutlet && seat.specs.powerOutlet) {
                score += 8;
            }
            const dist = Math.hypot(seat.position.x - referenceSeat.position.x, seat.position.z - referenceSeat.position.z);
            if (seat.spaceId === referenceSeat.spaceId && dist < 4.5) {
                score += 8;
                reasons.push('距離原座位僅數步');
            }
        }
        if (preferredEquipment) {
            const equipKeys = Object.keys(preferredEquipment);
            for (const k of equipKeys) {
                if (preferredEquipment[k] && seat.specs[k]) {
                    score += 15;
                    reasons.push(EQUIPMENT_LABELS[k]);
                }
            }
        }
        if (seat.specs.powerOutlet && reasons.length < 3) {
            reasons.push(seat.specs.outletType);
        }
        if (seat.specs.ergonomicChair && reasons.length < 3) {
            reasons.push('人體工學網椅');
        }
        return {
            seat,
            score: Math.min(99, score),
            reasons: Array.from(new Set(reasons)).slice(0, 3),
        };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
export const EQUIPMENT_LABELS = {
    powerOutlet: 'AC / USB-C 電源',
    dualMonitor: '雙螢幕擴充',
    deskLamp: '護眼調光檯燈',
    windowView: '自然窗景採光',
    ergonomicChair: '人體工學椅',
    ultraQuiet: '極靜專注區',
};
export const TIME_SLOTS = [
    '08:00 – 12:00 上午時段',
    '13:00 – 17:00 下午時段（目前）',
    '17:30 – 21:30 夜間時段',
];
export const ISSUE_TYPE_LABELS = {
    seat_occupied_by_other: '現場已被他人入座',
    items_left_unbooked: '桌面留有不明物品佔位',
    equipment_fault: '電源／檯燈／螢幕異常',
    noise_disturbance: '鄰近區域音量干擾',
};
