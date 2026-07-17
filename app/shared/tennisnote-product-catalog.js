(function () {
  const fourWeekPrices = {
    weekday: {
      1: {
        1: { 20: [165000, 150000], 30: [198000, 180000] },
        2: { 20: [121000, 110000], 30: [137500, 125000] },
      },
      2: {
        1: { 20: [286000, 260000], 30: [341000, 310000] },
        2: { 20: [198000, 180000], 30: [258000, 235000] },
      },
      3: {
        1: { 20: [407000, 370000], 30: [451000, 410000] },
        2: { 20: [264000, 240000], 30: [346500, 315000] },
      },
    },
    weekend: {
      1: {
        1: { 20: [176000, 160000], 40: [297000, 270000] },
        2: { 20: [132000, 120000], 40: [209000, 190000] },
      },
      2: {
        1: { 20: [297000, 270000], 40: [539000, 490000] },
        2: { 20: [209000, 190000], 40: [363000, 330000] },
      },
    },
  };

  const couponPrices = {
    1: {
      5: [231000, 210000, 8],
      10: [440000, 400000, 18],
      15: [644000, 585000, 28],
      20: [836000, 760000, 38],
    },
    2: {
      5: [176000, 160000, 8],
      10: [330000, 300000, 18],
      15: [478500, 435000, 28],
      20: [616000, 560000, 38],
    },
  };

  const scopeLabel = { weekday: "평일", weekend: "주말" };

  function roundThousand(value) {
    return Math.round(Number(value || 0) / 1000) * 1000;
  }

  function threeMonthPrice(fourWeekCash) {
    const cash = roundThousand(Number(fourWeekCash || 0) * 3 * 0.9);
    return [roundThousand(cash * 1.1), cash];
  }

  function regularProduct({ scope, weeks, frequency, groupSize, minutes, card, cash }) {
    const isThreeMonth = weeks === 12;
    const sessions = frequency * weeks;
    const lessonType = groupSize === 2 ? "2대1" : "1대1";
    const periodLabel = isThreeMonth ? "3개월" : "4주";
    const maxSessionsPerWeek = isThreeMonth ? 0 : ({ 1: 2, 2: 3, 3: 5 }[frequency] || frequency);
    return {
      id: `${scope}-regular-${weeks}w-${groupSize}to1-${minutes}m-w${frequency}`,
      group: `${scopeLabel[scope]} 정규권`,
      name: `${scopeLabel[scope]} ${periodLabel} ${lessonType} ${minutes}분 주${frequency}회 ${sessions}회`,
      title: `${scopeLabel[scope]} ${periodLabel} ${lessonType} ${minutes}분 주${frequency}회 ${sessions}회`,
      detail: `${minutes}분 레슨 · 담당 코치 고정 · ${scopeLabel[scope]} 예약`,
      format: `${lessonType} · ${minutes}분`,
      sessions: `${sessions}회`,
      rule: isThreeMonth
        ? "12주 수업, 보강 포함 15주 이내 · 같은 날 최대 2회"
        : `4주 수업, 보강 1주 · 주 최대 ${maxSessionsPerWeek}회 · 같은 날 최대 2회`,
      listAmount: card,
      amount: cash,
      settlementBase: cash,
      tickets: sessions,
      cardAmount: card,
      cashAmount: cash,
      validityDays: weeks * 7,
      graceDays: isThreeMonth ? 21 : 7,
      lessonMinutes: minutes,
      groupSize,
      frequencyPerWeek: frequency,
      scheduleScope: scope,
      termWeeks: weeks,
      maxSessionsPerDay: 2,
      maxSessionsPerWeek,
      maxBookingDaysPerWeek: 0,
      makeupAnchorMinutes: 40,
      productKind: "regular",
      discountEnabled: true,
      coachDiscountAllowed: false,
      coach: "선택한 담당 코치 전용",
      flow: "가능 시간 선택 → 담당 코치 확정 → 결제",
      mode: "fixed",
      discount: isThreeMonth ? "4주권 3회 금액에서 10% 할인" : "카드가/계좌이체가 분리",
      badge: isThreeMonth ? "3개월" : `주${frequency}회`,
      status: "sale",
    };
  }

  function regularProducts() {
    return Object.entries(fourWeekPrices).flatMap(([scope, frequencies]) =>
      Object.entries(frequencies).flatMap(([frequencyText, groups]) =>
        Object.entries(groups).flatMap(([groupSizeText, minutesMap]) =>
          Object.entries(minutesMap).flatMap(([minutesText, prices]) => {
            const frequency = Number(frequencyText);
            const groupSize = Number(groupSizeText);
            const minutes = Number(minutesText);
            const [card, cash] = prices;
            const [threeCard, threeCash] = threeMonthPrice(cash);
            return [
              regularProduct({ scope, weeks: 4, frequency, groupSize, minutes, card, cash }),
              regularProduct({ scope, weeks: 12, frequency, groupSize, minutes, card: threeCard, cash: threeCash }),
            ];
          }),
        ),
      ),
    );
  }

  function couponProduct(scope, groupSize, sessions, prices) {
    const [card, cash, validityWeeks] = prices;
    const lessonType = groupSize === 2 ? "2대1" : "1대1";
    const productId = groupSize === 2
      ? `${scope}-coupon-2to1-20m-${sessions}x`
      : `${scope}-coupon-20m-${sessions}x`;
    return {
      id: productId,
      group: `${scopeLabel[scope]} 쿠폰제`,
      name: `${scopeLabel[scope]} ${lessonType} 20분 쿠폰 ${sessions}회`,
      title: `${scopeLabel[scope]} ${lessonType} 20분 쿠폰 ${sessions}회`,
      detail: `고정시간 없이 정규권 배정 후 담당 코치의 ${scopeLabel[scope]} 빈 시간 예약`,
      format: `${lessonType} · 20분`,
      sessions: `${sessions}회`,
      rule: `${validityWeeks}주 이내 · 정규권 우선 · 주 2일, 하루 2회, 주 최대 4회`,
      listAmount: card,
      amount: cash,
      settlementBase: cash,
      tickets: sessions,
      cardAmount: card,
      cashAmount: cash,
      validityDays: validityWeeks * 7,
      graceDays: 0,
      lessonMinutes: 20,
      groupSize,
      frequencyPerWeek: 0,
      scheduleScope: scope,
      termWeeks: validityWeeks,
      maxSessionsPerDay: 2,
      maxSessionsPerWeek: 4,
      maxBookingDaysPerWeek: 2,
      makeupAnchorMinutes: 0,
      productKind: "coupon",
      discountEnabled: true,
      coachDiscountAllowed: true,
      coach: "선택한 담당 코치 전용",
      flow: "담당 코치 선택 → 결제 → 가능한 시간 예약",
      mode: "pass",
      discount: sessions >= 10 ? "다회 구매 할인 반영" : "기준 쿠폰가",
      badge: `${sessions}회`,
      status: "sale",
    };
  }

  function couponProducts() {
    return ["weekday", "weekend"].flatMap((scope) =>
      Object.entries(couponPrices).flatMap(([groupSizeText, sessionPrices]) =>
        Object.entries(sessionPrices).map(([sessions, prices]) =>
          couponProduct(scope, Number(groupSizeText), Number(sessions), prices),
        ),
      ),
    );
  }

  function createCatalog() {
    return [...regularProducts(), ...couponProducts()];
  }

  const policy = Object.freeze({
    regularFourWeek: {
      validityDays: 28,
      graceDays: 7,
      maxPerDay: 2,
      maxPerWeekByFrequency: { 1: 2, 2: 3, 3: 5 },
    },
    regularThreeMonth: {
      validityDays: 84,
      graceDays: 21,
      maxPerDay: 2,
      maxPerWeek: 0,
    },
    coupon: {
      validityWeeksBySessions: { 5: 8, 10: 18, 15: 28, 20: 38 },
      maxBookingDaysPerWeek: 2,
      maxPerDay: 2,
      maxPerWeek: 4,
      personalHoldDays: 0,
    },
    makeup: {
      sameCoachOnly: true,
      sameScheduleScopeOnly: true,
      anchorMinutes: 40,
      adminOverride: true,
    },
    holding: {
      fourWeekPersonalDays: 7,
      threeMonthPersonalDays: 14,
      injuryDays: 30,
      evidenceRequired: true,
      emergencyRetroactiveDays: 3,
    },
    transfer: {
      maxTransfers: 1,
      wholeRemainderOnly: true,
      freeOrEventTicketTransferable: false,
    },
    refund: {
      penaltyRate: 10,
      reservationFee: 30000,
      basis: "undiscounted_original_price",
      disputeFallbackAdminOnly: true,
    },
  });

  window.TennisNoteProductCatalog = {
    createCatalog,
    policy,
    roundThousand,
    threeMonthPrice,
  };
})();
