pub mod claude;
pub mod codex;

use crate::models::{AiWaitingIntervalRecord, AiWaitingIntervalSource};
use crate::util::seconds_between;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum AiEventKind {
    User,
    Ai,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct AiEvent {
    pub at: String,
    pub kind: AiEventKind,
}

pub fn infer_ai_waiting_intervals(events: Vec<AiEvent>) -> Vec<AiWaitingIntervalRecord> {
    let mut events = events;
    events.sort();
    events.dedup();

    let mut intervals = Vec::new();
    let mut current_user_at: Option<String> = None;
    let mut last_ai_at: Option<String> = None;

    let mut finish_turn = |user_at: &mut Option<String>, ai_at: &mut Option<String>| {
        let (Some(user_sent_at), Some(ai_finished_at)) = (user_at.take(), ai_at.take()) else {
            *ai_at = None;
            return;
        };
        let seconds = seconds_between(&user_sent_at, Some(&ai_finished_at));
        if seconds > 0 {
            intervals.push(AiWaitingIntervalRecord {
                user_sent_at,
                ai_finished_at,
                seconds,
                source: AiWaitingIntervalSource::Inferred,
            });
        }
    };

    for event in events {
        match event.kind {
            AiEventKind::User => {
                finish_turn(&mut current_user_at, &mut last_ai_at);
                current_user_at = Some(event.at);
            }
            AiEventKind::Ai => {
                if current_user_at.is_some() {
                    last_ai_at = Some(event.at);
                }
            }
        }
    }
    finish_turn(&mut current_user_at, &mut last_ai_at);

    intervals
}
