mod api;
mod artworks;
mod db;
mod image_http;
mod llm_proxy;
mod migrate;
mod provider;
mod speech;
mod speech_dialog;
mod speech_http;
mod vault;
mod video_http;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize SQLite Database and Tables on startup
            db::init_db(app.handle()).map_err(|e| {
                eprintln!("Database initialization failed: {}", e);
                e
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::get_current_user,
            api::create_local_user,
            api::update_user_info,
            api::upload_user_avatar,
            api::read_local_avatar,
            api::get_claw_groups,
            api::create_claw_group,
            api::join_claw_group,
            api::get_claw_messages,
            api::send_claw_message,
            api::list_ai_members,
            api::get_ai_member,
            api::upsert_ai_member,
            api::delete_ai_member,
            api::seed_builtin_ai_members,
            api::secret_set,
            api::secret_has,
            api::secret_copy,
            api::secret_delete,
            api::secret_list_names,
            llm_proxy::llm_chat_stream,
            speech::speech_tts_synthesize,
            speech::speech_asr_start,
            speech::speech_asr_send,
            speech::speech_asr_stop,
            speech::speech_asr_abort,
            speech_http::speech_http_tts,
            speech_http::speech_http_asr,
            speech_dialog::speech_dialog_start,
            speech_dialog::speech_dialog_send,
            speech_dialog::speech_dialog_commit,
            speech_dialog::speech_dialog_close,
            image_http::image_http_generate,
            image_http::artwork_save_data_url,
            image_http::artwork_read_data_url,
            video_http::video_http_animate,
            video_http::artwork_read_video_bytes,
            artworks::list_kid_artworks,
            artworks::save_kid_artwork,
            artworks::delete_kid_artwork,
            artworks::list_kid_storybooks,
            artworks::upsert_kid_storybook,
            artworks::delete_kid_storybook,
            provider::list_providers,
            provider::get_provider,
            provider::upsert_provider,
            provider::delete_provider,
            provider::seed_builtin_providers,
            provider::provider_test,
            provider::provider_ping,
            migrate::migrate_a_complete,
            migrate::migration_status
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(desktop)]
            if let tauri::RunEvent::Ready = event {
                apply_window_icons(&app_handle);
            }
            #[cfg(not(desktop))]
            let _ = (&app_handle, &event);
        });
}

/// macOS 开发模式下 Dock 图标有时不会自动刷新，显式同步窗口图标。
#[cfg(desktop)]
fn apply_window_icons(app: &tauri::AppHandle) {
    use tauri::Manager;

    let Some(icon) = app.default_window_icon().cloned() else {
        return;
    };

    for (_, window) in app.webview_windows() {
        let _ = window.set_icon(icon.clone());
    }
}
