set role authenticated; set request.jwt.claims = '{"sub":"userP"}';
\timing on
select 'summary 90d', (video_analytics_summary('perfvid001', current_date-90, current_date)->>'plays');
select 'timeseries 90d', jsonb_array_length(video_analytics_timeseries('perfvid001', current_date-90, current_date)::jsonb);
select 'retention 90d', jsonb_array_length(video_retention_curve('perfvid001', current_date-90, current_date)::jsonb);
select 'cta 90d', 1 from video_cta_performance('perfvid001', current_date-90, current_date) limit 1;
select 'portfolio 90d', owner_portfolio_summary(current_date-90, current_date)->>'plays';
select 'owner_video_stats', count(*) from owner_video_stats(current_date-30, current_date);
