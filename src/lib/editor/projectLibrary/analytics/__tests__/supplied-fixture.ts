// TEST-ONLY copy of the supplied demo fixture. Never import this from production code (see noFixtureInProduction.test.js).
import type { ProjectAnalyticsData, AnalyticsPeriod } from '../SmartVideoAnalytics';
// DEMO ONLY. Do not use this fixture in production analytics.
const dates = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const demoAnalytics: Record<AnalyticsPeriod, ProjectAnalyticsData> = {
  '7d': {
    projectId: 'demo-kitchen', projectName: 'Kitchen Renovation Promo', status: 'published',
    durationMs: 150000, publishedUrl: 'https://smartvid.app/v/example/kitchen-renovation',
    metrics: { plays: 1248, uniqueViewers: 892, completionRate: 67, avgWatchSeconds: 102, ctaClicks: 94, leads: 34 },
    playsOverTime: dates.map((day,i)=>({day,plays:[105,132,161,154,210,235,251][i]})),
    retention: [{positionPercent:0,retentionPercent:100},{positionPercent:10,retentionPercent:94},{positionPercent:25,retentionPercent:86},{positionPercent:40,retentionPercent:82},{positionPercent:50,retentionPercent:79},{positionPercent:65,retentionPercent:75},{positionPercent:75,retentionPercent:72},{positionPercent:90,retentionPercent:68},{positionPercent:100,retentionPercent:67}],
    sections: [{id:'a',title:'Kitchen Designs',startMs:0,endMs:45000,engagementPercent:89},{id:'b',title:'Cabinet Upgrades',startMs:45000,endMs:95000,engagementPercent:74},{id:'c',title:'Pricing and Estimates',startMs:95000,endMs:150000,engagementPercent:61}],
    conversions:[{label:'Pricing',clicks:94},{label:'Book consultation',clicks:52},{label:'Call business',clicks:41},{label:'Request quote',clicks:34}],
    opportunities:[{id:'pricing',icon:'trend',title:'Pricing engagement increased',explanation:'Viewers are interacting with pricing information.',suggestion:'Suggested action: Create a pricing explainer video.'},{id:'new-lead',icon:'lead',title:'New lead captured',explanation:'A viewer submitted an estimate request through your published video.',suggestion:'Suggested action: Review the inquiry.'},{id:'repeat',icon:'repeat',title:'Repeat interest detected',explanation:'A recognized viewer engaged with the renovation section again.',suggestion:'Suggested action: Review audience insights.'}]
  },
  '30d': null as unknown as ProjectAnalyticsData,
  '90d': null as unknown as ProjectAnalyticsData
};
demoAnalytics['30d'] = {...demoAnalytics['7d'],metrics:{plays:5132,uniqueViewers:3580,completionRate:64,avgWatchSeconds:96,ctaClicks:387,leads:129}};
demoAnalytics['90d'] = {...demoAnalytics['7d'],metrics:{plays:13780,uniqueViewers:9850,completionRate:61,avgWatchSeconds:91,ctaClicks:1012,leads:311}};
