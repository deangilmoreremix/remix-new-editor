/* eslint-disable */
import React from 'react';
import { CalendarMonthFill } from "../vendored/scenes/calendar-month-fill";
// GENERATED from the RemotionUI docs usage example for "calendar-month-fill" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CalendarMonthFill
        month="August"
        year="2026"
        daysInMonth={31}
        startWeekday={5}
        todayDay={15}
        events={[
          { day: 4, label: "Kickoff", color: "#7DD3E8" },
          { day: 15, label: "Render day", color: "#9BD4A0" },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
