use base64::Engine;
use std::os::windows::ffi::OsStrExt;
use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDIBits,
    GetObjectW, CreateCompatibleDC,
};
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

pub struct IconData {
    pub base64: String,
}

pub fn extract_icon_from_exe(exe_path: &str) -> Option<IconData> {
    if exe_path.is_empty() {
        return None;
    }

    let lpszfile: Vec<u16> = std::path::Path::new(exe_path)
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();

    let mut phiconlarge = HICON::default();
    let mut phiconsmall = HICON::default();

    let value = unsafe {
        ExtractIconExW(
            PCWSTR(lpszfile.as_ptr()),
            0,
            Some(&mut phiconlarge as *mut HICON),
            Some(&mut phiconsmall as *mut HICON),
            1,
        )
    };

    if value == 0 || (phiconlarge.0.is_null() && phiconsmall.0.is_null()) {
        return None;
    }

    let phicon = if !phiconlarge.0.is_null() {
        phiconlarge
    } else {
        phiconsmall
    };

    let mut piconinfo: ICONINFO = ICONINFO::default();
    let icon_info = unsafe { GetIconInfo(phicon, &mut piconinfo as *mut ICONINFO as _) };
    if icon_info.is_err() {
        cleanup_hicons(phiconlarge, phiconsmall);
        return None;
    }

    let hbm = piconinfo.hbmColor;
    let mut cbitmap = BITMAP::default();

    let objectw = unsafe {
        GetObjectW(
            hbm.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut cbitmap as *mut _ as _),
        )
    };

    if objectw <= 0 {
        cleanup_hicons(phiconlarge, phiconsmall);
        return None;
    }

    let mut lpbmi = BITMAPINFO::default();
    lpbmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    lpbmi.bmiHeader.biWidth = cbitmap.bmWidth;
    lpbmi.bmiHeader.biHeight = -cbitmap.bmHeight;
    lpbmi.bmiHeader.biPlanes = 1;
    lpbmi.bmiHeader.biBitCount = 32;
    lpbmi.bmiHeader.biCompression = BI_RGB.0;

    let hdc = unsafe { CreateCompatibleDC(None) };
    let mut buffer: Vec<u8> = vec![0u8; (cbitmap.bmHeight * cbitmap.bmWidth * 4) as usize];
    let height = unsafe {
        GetDIBits(
            hdc,
            hbm,
            0,
            cbitmap.bmHeight as u32,
            Some(buffer.as_mut_ptr().cast()),
            &mut lpbmi,
            DIB_RGB_COLORS,
        )
    };

    let mut result = None;

    if height == cbitmap.bmHeight {
        for chunk in buffer.chunks_mut(4) {
            if chunk.len() == 4 {
                chunk.swap(0, 2);
            }
        }

        let png_data = 'png: {
            let mut buf = Vec::new();
            {
                let cursor = std::io::Cursor::new(&mut buf);
                let mut encoder = png::Encoder::new(cursor, cbitmap.bmWidth as u32, cbitmap.bmHeight as u32);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);

                if let Ok(mut writer) = encoder.write_header() {
                    if writer.write_image_data(&buffer).is_err() {
                        result = None;
                        return result;
                    }
                } else {
                    result = None;
                    return result;
                }
            }
            break 'png buf;
        };

        use base64::prelude::BASE64_STANDARD;
        let base64_str = BASE64_STANDARD.encode(&png_data);
        result = Some(IconData {
            base64: format!("data:image/png;base64,{base64_str}"),
        });
    }

    unsafe {
        let _ = DeleteDC(hdc);
        let _ = DeleteObject(hbm.into());
    };

    cleanup_hicons(phiconlarge, phiconsmall);
    result
}

fn cleanup_hicons(phiconlarge: HICON, phiconsmall: HICON) {
    unsafe {
        if !phiconlarge.0.is_null() {
            let _ = DestroyIcon(phiconlarge);
        }
        if !phiconsmall.0.is_null() {
            let _ = DestroyIcon(phiconsmall);
        }
    }
}
