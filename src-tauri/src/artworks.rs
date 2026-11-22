//! 魔法画室画作与绘本共创作品的 SQLite 持久化。

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::db::get_db_path;
use crate::image_http::remove_artwork_file_if_in_sandbox;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KidArtwork {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub style: String,
    pub mode: String,
    pub image_path: String,
    #[serde(default)]
    pub sketch_path: Option<String>,
    #[serde(default)]
    pub video_path: Option<String>,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KidStorybook {
    pub id: String,
    pub title: String,
    pub author: String,
    pub style: String,
    pub hero_name: String,
    pub hero_desc: String,
    pub cover_path: String,
    #[serde(default)]
    pub cover_video_path: Option<String>,
    pub pages_json: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub(crate) mod db {
    use super::*;

    pub fn list_artworks(conn: &Connection) -> Result<Vec<KidArtwork>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, prompt, style, mode, image_path, sketch_path, video_path, created_at
                 FROM kid_artworks ORDER BY created_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(KidArtwork {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    prompt: row.get(2)?,
                    style: row.get(3)?,
                    mode: row.get(4)?,
                    image_path: row.get(5)?,
                    sketch_path: row.get(6)?,
                    video_path: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn save_artwork(conn: &Connection, art: &KidArtwork) -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO kid_artworks (id, title, prompt, style, mode, image_path, sketch_path, video_path, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                art.id,
                art.title,
                art.prompt,
                art.style,
                art.mode,
                art.image_path,
                art.sketch_path,
                art.video_path,
                art.created_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_artwork(conn: &Connection, id: &str) -> Result<Vec<String>, String> {
        let paths: Option<(String, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT image_path, sketch_path, video_path FROM kid_artworks WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM kid_artworks WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        let mut to_remove = Vec::new();
        if let Some((img, sketch, video)) = paths {
            to_remove.push(img);
            if let Some(s) = sketch {
                to_remove.push(s);
            }
            if let Some(v) = video {
                to_remove.push(v);
            }
        }
        Ok(to_remove)
    }

    pub fn list_storybooks(conn: &Connection) -> Result<Vec<KidStorybook>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, author, style, hero_name, hero_desc, cover_path, cover_video_path, pages_json, status, created_at, updated_at
                 FROM kid_storybooks ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(KidStorybook {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    author: row.get(2)?,
                    style: row.get(3)?,
                    hero_name: row.get(4)?,
                    hero_desc: row.get(5)?,
                    cover_path: row.get(6)?,
                    cover_video_path: row.get(7)?,
                    pages_json: row.get(8)?,
                    status: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn upsert_storybook(conn: &Connection, book: &KidStorybook) -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO kid_storybooks
             (id, title, author, style, hero_name, hero_desc, cover_path, cover_video_path, pages_json, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                book.id,
                book.title,
                book.author,
                book.style,
                book.hero_name,
                book.hero_desc,
                book.cover_path,
                book.cover_video_path,
                book.pages_json,
                book.status,
                book.created_at,
                book.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_storybook(conn: &Connection, id: &str) -> Result<Vec<String>, String> {
        let row: Option<(String, Option<String>, String)> = conn
            .query_row(
                "SELECT cover_path, cover_video_path, pages_json FROM kid_storybooks WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM kid_storybooks WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        let mut to_remove = Vec::new();
        if let Some((cover_path, cover_video_path, pages_json)) = row {
            if !cover_path.trim().is_empty() {
                to_remove.push(cover_path);
            }
            if let Some(cv) = cover_video_path.filter(|s| !s.trim().is_empty()) {
                to_remove.push(cv);
            }
            if let Ok(pages) = serde_json::from_str::<Vec<Value>>(&pages_json) {
                for page in pages {
                    if let Some(p) = page["imagePath"].as_str().filter(|s| !s.trim().is_empty()) {
                        to_remove.push(p.to_string());
                    }
                    if let Some(vp) = page["videoPath"].as_str().filter(|s| !s.trim().is_empty()) {
                        to_remove.push(vp.to_string());
                    }
                }
            }
        }
        Ok(to_remove)
    }
}

#[tauri::command]
pub fn list_kid_artworks(app: AppHandle) -> Result<Vec<KidArtwork>, String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    db::list_artworks(&conn)
}

#[tauri::command]
pub fn save_kid_artwork(app: AppHandle, artwork: KidArtwork) -> Result<(), String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    db::save_artwork(&conn, &artwork)
}

#[tauri::command]
pub fn delete_kid_artwork(app: AppHandle, id: String) -> Result<(), String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    let files = db::delete_artwork(&conn, &id)?;
    for file in files {
        remove_artwork_file_if_in_sandbox(&app, &file);
    }
    Ok(())
}

#[tauri::command]
pub fn list_kid_storybooks(app: AppHandle) -> Result<Vec<KidStorybook>, String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    db::list_storybooks(&conn)
}

#[tauri::command]
pub fn upsert_kid_storybook(app: AppHandle, book: KidStorybook) -> Result<(), String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    db::upsert_storybook(&conn, &book)
}

#[tauri::command]
pub fn delete_kid_storybook(app: AppHandle, id: String) -> Result<(), String> {
    let conn = Connection::open(get_db_path(&app)).map_err(|e| e.to_string())?;
    let files = db::delete_storybook(&conn, &id)?;
    for file in files {
        remove_artwork_file_if_in_sandbox(&app, &file);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::db::*;
    use super::*;
    use crate::db::init_db_schemas;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db_schemas(&conn).unwrap();
        conn
    }

    #[test]
    fn artwork_crud_roundtrip() {
        let conn = test_conn();
        let art = KidArtwork {
            id: "art-1".into(),
            title: "月球小恐龙".into(),
            prompt: "戴草帽在月球吃西瓜的小恐龙".into(),
            style: "watercolor".into(),
            mode: "sketch".into(),
            image_path: "/tmp/art1.png".into(),
            sketch_path: Some("/tmp/sketch1.png".into()),
            video_path: Some("/tmp/anim1.mp4".into()),
            created_at: 1000,
        };
        save_artwork(&conn, &art).unwrap();
        let list = list_artworks(&conn).unwrap();
        assert_eq!(list, vec![art]);

        let removed = delete_artwork(&conn, "art-1").unwrap();
        assert_eq!(
            removed,
            vec![
                "/tmp/art1.png".to_string(),
                "/tmp/sketch1.png".to_string(),
                "/tmp/anim1.mp4".to_string(),
            ]
        );
        assert!(list_artworks(&conn).unwrap().is_empty());
    }

    #[test]
    fn storybook_crud_roundtrip() {
        let conn = test_conn();
        let book = KidStorybook {
            id: "book-1".into(),
            title: "月球面包店".into(),
            author: "乐乐".into(),
            style: "watercolor".into(),
            hero_name: "柴柴".into(),
            hero_desc: "戴蓝色围裙的小柴犬".into(),
            cover_path: "/tmp/cover.png".into(),
            cover_video_path: Some("/tmp/cover.mp4".into()),
            pages_json: r#"[{"pageNumber":1,"storyText":"第一页","imagePath":"/tmp/p1.png","videoPath":"/tmp/p1.mp4"}]"#.into(),
            status: "completed".into(),
            created_at: 100,
            updated_at: 200,
        };
        upsert_storybook(&conn, &book).unwrap();
        let list = list_storybooks(&conn).unwrap();
        assert_eq!(list, vec![book]);

        let removed = delete_storybook(&conn, "book-1").unwrap();
        assert_eq!(
            removed,
            vec![
                "/tmp/cover.png".to_string(),
                "/tmp/cover.mp4".to_string(),
                "/tmp/p1.png".to_string(),
                "/tmp/p1.mp4".to_string(),
            ]
        );
        assert!(list_storybooks(&conn).unwrap().is_empty());
    }
}
