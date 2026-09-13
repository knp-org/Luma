use notify::{
    event::{CreateKind, ModifyKind, RemoveKind},
    Event, EventKind, RecursiveMode, Watcher,
};
use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::Emitter;

static SETTINGS_REVISION: AtomicU64 = AtomicU64::new(0);
pub fn settings_changed() {
    SETTINGS_REVISION.fetch_add(1, Ordering::Relaxed);
}

#[derive(Default)]
struct Changes {
    paths: HashSet<PathBuf>,
    full: bool,
    first: Option<Instant>,
    last: Option<Instant>,
}
impl Changes {
    fn touch(&mut self) {
        let now = Instant::now();
        self.first.get_or_insert(now);
        self.last = Some(now);
    }
    fn rescan(&mut self) {
        self.full = true;
        self.paths.clear();
        self.touch();
    }
    fn add(&mut self, event: Event, internal: Option<&PathBuf>) {
        if event.need_rescan() {
            self.rescan();
            return;
        }
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        let directory_or_rename = matches!(
            event.kind,
            EventKind::Create(CreateKind::Folder)
                | EventKind::Remove(RemoveKind::Folder | RemoveKind::Any)
                | EventKind::Modify(ModifyKind::Name(_))
                | EventKind::Any
                | EventKind::Other
        );
        for path in event.paths {
            if internal.is_some_and(|dir| path.starts_with(dir)) {
                continue;
            }
            if directory_or_rename || path.is_dir() || crate::commands::is_music_path(&path) {
                self.touch();
                if !self.full {
                    self.paths.insert(path);
                }
                if self.paths.len() > 4096 {
                    self.rescan();
                }
            }
        }
    }
    fn ready(&self) -> bool {
        self.last
            .is_some_and(|last| last.elapsed() >= Duration::from_secs(2))
            || self
                .first
                .is_some_and(|first| first.elapsed() >= Duration::from_secs(30))
    }
}

pub fn start(app: tauri::AppHandle) {
    thread::spawn(move || {
        let (tx, rx) = mpsc::sync_channel(128);
        let overflow = Arc::new(AtomicBool::new(false));
        let overflow_callback = overflow.clone();
        let mut watcher = match notify::recommended_watcher(move |event: notify::Result<Event>| {
            if event
                .as_ref()
                .is_ok_and(|event| matches!(event.kind, EventKind::Access(_)))
            {
                return;
            }
            if tx.try_send(event).is_err() {
                overflow_callback.store(true, Ordering::Relaxed);
            }
        }) {
            Ok(watcher) => watcher,
            Err(e) => {
                eprintln!("Library watcher unavailable: {e}");
                return;
            }
        };
        let internal = dirs::config_dir().map(|dir| dir.join("luma"));
        let mut revision = SETTINGS_REVISION.load(Ordering::Relaxed);
        let mut stamp = crate::settings::settings_stamp();
        let mut settings = crate::settings::load_settings().unwrap_or_default();
        let mut settings_check = Instant::now();
        let mut watched: Vec<String> = Vec::new();
        let mut changes = Changes::default();
        loop {
            let mut receive = |event| match event {
                Ok(event) => changes.add(event, internal.as_ref()),
                Err(_) => changes.rescan(),
            };
            if let Ok(event) = rx.recv_timeout(Duration::from_secs(1)) {
                receive(event);
            }
            for _ in 0..128 {
                match rx.try_recv() {
                    Ok(event) => receive(event),
                    Err(_) => break,
                }
            }
            if overflow.swap(false, Ordering::Relaxed) {
                changes.rescan();
            }
            let current_revision = SETTINGS_REVISION.load(Ordering::Relaxed);
            // Preserve external settings edits with a cheap, infrequent stat.
            let current_stamp = if settings_check.elapsed() >= Duration::from_secs(5) {
                settings_check = Instant::now();
                crate::settings::settings_stamp()
            } else {
                stamp
            };
            if current_revision != revision || current_stamp != stamp {
                if let Ok(updated) = crate::settings::load_settings() {
                    if settings.directories() != updated.directories()
                        || settings.watch_library != updated.watch_library
                    {
                        changes.rescan();
                    }
                    settings = updated;
                    revision = current_revision;
                    stamp = current_stamp;
                }
            }
            let desired = if settings.watch_library {
                settings.directories()
            } else {
                vec![]
            };
            for old in &watched {
                if !desired.contains(old) || !std::path::Path::new(old).is_dir() {
                    changes.rescan();
                    let _ = watcher.unwatch(std::path::Path::new(old));
                }
            }
            watched.retain(|old| desired.contains(old) && std::path::Path::new(old).is_dir());
            for directory in desired {
                if !watched.contains(&directory)
                    && watcher
                        .watch(std::path::Path::new(&directory), RecursiveMode::Recursive)
                        .is_ok()
                {
                    watched.push(directory);
                    changes.rescan();
                }
            }
            if !settings.watch_library {
                changes = Changes::default();
            }
            if changes.ready() {
                let batch = std::mem::take(&mut changes);
                let result = if batch.full {
                    crate::commands::scan_directories(app.clone(), settings.directories())
                } else {
                    crate::commands::scan_changed_paths(
                        app.clone(),
                        settings.directories(),
                        batch.paths.into_iter().collect(),
                    )
                };
                match result {
                    Ok(result) => {
                        let _ = app.emit("library-updated", result);
                    }
                    Err(e) => {
                        let _ = app.emit("library-error", e);
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn filters_non_music_changes_and_preserves_both_rename_paths() {
        let mut changes = Changes::default();
        changes.add(
            Event::new(EventKind::Modify(ModifyKind::Any)).add_path("/music/notes.txt".into()),
            None,
        );
        assert!(changes.paths.is_empty());
        changes.add(
            Event::new(EventKind::Modify(ModifyKind::Name(
                notify::event::RenameMode::Both,
            )))
            .add_path("/music/old.flac".into())
            .add_path("/music/new.flac".into()),
            None,
        );
        assert_eq!(changes.paths.len(), 2);
        changes.add(
            Event::new(EventKind::Remove(RemoveKind::Folder)).add_path("/music/album".into()),
            None,
        );
        assert!(changes.paths.contains(&PathBuf::from("/music/album")));
    }
}
