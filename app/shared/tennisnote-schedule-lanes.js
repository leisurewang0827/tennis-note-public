(function installTennisNoteScheduleLanes(globalScope) {
  "use strict";

  function coachIdentity(coach = {}) {
    coach = coach || {};
    return String(coach.roleId || coach.serverRoleId || coach.id || coach.name || "").trim();
  }

  function laneOrderValue(coach = {}, fallbackIndex = 0) {
    const candidates = [coach.laneOrder, coach.scheduleLaneOrder, coach.sortIndex];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value)) return value;
    }
    return 1000 + Number(fallbackIndex || 0);
  }

  function sortByLaneOrder(coaches = []) {
    return [...coaches]
      .map((coach, index) => ({ coach, index }))
      .sort((left, right) => {
        const order = laneOrderValue(left.coach, left.index) - laneOrderValue(right.coach, right.index);
        if (order) return order;
        // The workspace array is the server contract. Preserve it when two
        // coaches share the default order so a shift change cannot swap lanes.
        if (left.index !== right.index) return left.index - right.index;
        const nameOrder = String(left.coach?.name || "").localeCompare(String(right.coach?.name || ""), "ko");
        if (nameOrder) return nameOrder;
        return coachIdentity(left.coach).localeCompare(coachIdentity(right.coach));
      })
      .map((item) => item.coach);
  }

  function assignStableLanes(groups = []) {
    const preferredLane = new Map();
    let laneCount = 0;
    const rows = groups.map((group = []) => {
      const active = sortByLaneOrder(group)
        .filter((coach, index, values) => (
          coachIdentity(coach)
          && values.findIndex((item) => coachIdentity(item) === coachIdentity(coach)) === index
        ));
      const lanes = Array(Math.max(active.length, laneCount)).fill(null);

      active
        .filter((coach) => preferredLane.has(coachIdentity(coach)))
        .sort((left, right) => preferredLane.get(coachIdentity(left)) - preferredLane.get(coachIdentity(right)))
        .forEach((coach) => {
          const lane = preferredLane.get(coachIdentity(coach));
          if (lane < lanes.length && !lanes[lane]) lanes[lane] = coach;
        });

      active.filter((coach) => !lanes.includes(coach)).forEach((coach) => {
        let lane = lanes.findIndex((item) => !item);
        if (lane < 0) {
          lane = lanes.length;
          lanes.push(null);
        }
        lanes[lane] = coach;
      });

      const occupiedLaneCount = lanes.reduce((max, coach, lane) => (coach ? Math.max(max, lane + 1) : max), 0);
      laneCount = Math.max(laneCount, occupiedLaneCount);
      if (active.length > 1) {
        active.forEach((coach) => {
          const identity = coachIdentity(coach);
          const lane = lanes.findIndex((item) => coachIdentity(item) === identity);
          preferredLane.set(identity, lane);
        });
      }

      return lanes;
    });

    return {
      laneCount: Math.max(1, laneCount),
      preferredLane,
      rows: rows.map((row) => Array.from({ length: Math.max(1, laneCount) }, (_, lane) => row[lane] || null)),
    };
  }

  const api = {
    assignStableLanes,
    coachIdentity,
    laneOrderValue,
    sortByLaneOrder,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.TennisNoteScheduleLanes = api;
})(typeof window !== "undefined" ? window : globalThis);
