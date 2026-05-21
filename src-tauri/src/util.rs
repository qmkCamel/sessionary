use chrono::{DateTime, Datelike, FixedOffset, NaiveDate, SecondsFormat, Utc};
use sha1::{Digest, Sha1};

pub fn stable_id(input: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

pub fn normalize_timestamp(value: &str) -> Option<String> {
    DateTime::parse_from_rfc3339(value).ok().map(|dt| {
        dt.with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Millis, true)
    })
}

pub fn parse_utc(value: &str) -> anyhow::Result<DateTime<Utc>> {
    Ok(DateTime::parse_from_rfc3339(value)?.with_timezone(&Utc))
}

pub fn seconds_between(started_at: &str, ended_at: Option<&str>) -> i64 {
    let Some(ended_at) = ended_at else {
        return 0;
    };
    let Ok(started) = parse_utc(started_at) else {
        return 0;
    };
    let Ok(ended) = parse_utc(ended_at) else {
        return 0;
    };
    (ended - started).num_seconds().max(0)
}

pub fn clamp(value: i64, min: i64, max: i64) -> i64 {
    value.max(min).min(max)
}

pub fn truncate(value: &str, length: usize) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= length {
        normalized
    } else {
        let mut out = normalized
            .chars()
            .take(length.saturating_sub(3))
            .collect::<String>();
        out.push_str("...");
        out
    }
}

pub fn today_local() -> String {
    let offset = FixedOffset::east_opt(8 * 3600).expect("valid offset");
    Utc::now()
        .with_timezone(&offset)
        .format("%Y-%m-%d")
        .to_string()
}

pub fn day_range(date: &str) -> anyhow::Result<(String, String)> {
    let start =
        DateTime::parse_from_rfc3339(&format!("{date}T00:00:00+08:00"))?.with_timezone(&Utc);
    let end = start + chrono::Duration::days(1);
    Ok((
        start.to_rfc3339_opts(SecondsFormat::Millis, true),
        end.to_rfc3339_opts(SecondsFormat::Millis, true),
    ))
}

pub fn week_range(date: &str) -> anyhow::Result<(String, String, String, String)> {
    let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d")?;
    let start_date = parsed
        - chrono::Duration::days(parsed.weekday().num_days_from_monday() as i64);
    let end_date = start_date + chrono::Duration::days(6);
    let start_label = start_date.format("%Y-%m-%d").to_string();
    let end_label = end_date.format("%Y-%m-%d").to_string();
    let (start_iso, _) = day_range(&start_label)?;
    let (_, end_iso) = day_range(&end_label)?;
    Ok((start_label, end_label, start_iso, end_iso))
}

pub fn local_date(iso: &str) -> Option<String> {
    let offset = FixedOffset::east_opt(8 * 3600)?;
    let dt = parse_utc(iso).ok()?;
    Some(dt.with_timezone(&offset).format("%Y-%m-%d").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn week_range_uses_monday_to_sunday() {
        let (start, end, start_iso, end_iso) = week_range("2026-05-20").expect("week range");

        assert_eq!(start, "2026-05-18");
        assert_eq!(end, "2026-05-24");
        assert!(start_iso.starts_with("2026-05-17T16:00:00"));
        assert!(end_iso.starts_with("2026-05-24T16:00:00"));
    }
}
