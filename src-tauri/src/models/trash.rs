use serde::Serialize;
use super::{board::Board, column::Column, task::Task, tag::Tag};

#[derive(Debug, Clone, Serialize)]
pub struct TrashData {
    pub boards: Vec<Board>,
    pub columns: Vec<Column>,
    pub tasks: Vec<Task>,
    pub tags: Vec<Tag>,
}
