use chrono::{DateTime, FixedOffset, SecondsFormat, Utc};
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

pub fn local_date(iso: &str) -> Option<String> {
    let offset = FixedOffset::east_opt(8 * 3600)?;
    let dt = parse_utc(iso).ok()?;
    Some(dt.with_timezone(&offset).format("%Y-%m-%d").to_string())
}
