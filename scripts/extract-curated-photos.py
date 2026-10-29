#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Galata Rotary Kulübü — Curated Photo & Brand Asset Selective Extractor
Selectively extracts only curated photos and brand assets from WhatsApp archives
to prevent disk exhaustion and repository bloat.
"""

import os
import sys
import zipfile
import shutil

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, 'public')
PHOTOS_DIR = os.path.join(PUBLIC_DIR, 'assets', 'photos')
BRAND_DIR = os.path.join(PUBLIC_DIR, 'assets', 'brand')

ZIP_GALATA_RK = r'C:\Users\Asus\Downloads\WhatsApp Chat - Galata RK.zip'
ZIP_BULTEN = r'C:\Users\Asus\Downloads\WhatsApp Chat - 2026-2027 Bülten_0986.zip'

# Curated Photo Mappings:
# Month -> list of tuples: (source_zip_type, prefix_or_filename, target_filename, optional_alias)
PHOTO_MAPPINGS = {
    '2026-07': [
        ('galata', '00004876', '00004876-PHOTO-2026-07-05-15-46-51.jpg', '00004876.jpg'),
        ('galata', '00004889', '00004889-degisim-ogrencisi-1.jpg', '00004889.jpg'),
        ('galata', '00004890', '00004890-degisim-ogrencisi-2.jpg', '00004890.jpg'),
        ('galata', '00004896', '00004896-anne-cocuk-sagligi.jpg', '00004896.jpg'),
        ('galata', '00004919', '00004919-dostluk-paylasimi.jpg', '00004919.jpg'),
        ('galata', '00004967', '00004967-sergi-davet.jpg', '00004967.jpg'),
    ],
    '2026-08': [
        ('galata', '00005031', '00005031-gaye-binark-uyelik-1.jpg', '00005031.jpg'),
        ('galata', '00005032', '00005032-gaye-binark-uyelik-2.jpg', '00005032.jpg'),
        ('galata', '00005033', '00005033-gaye-binark-uyelik-3.jpg', '00005033.jpg'),
        ('galata', '00005034', '00005034-gaye-binark-uyelik-4.jpg', '00005034.jpg'),
        ('galata', '00005035', '00005035-gaye-binark-uyelik-5.jpg', '00005035.jpg'),
        ('galata', '00005036', '00005036-gaye-binark-uyelik-6.jpg', '00005036.jpg'),
        ('galata', '00005046', '00005046-adil-acar-dogum-gunu.jpg', '00005046.jpg'),
        ('galata', '00005124', '00005124-burak-catlioglu-afet-afis.jpg', '00005124.jpg'),
        ('galata', '00005145', '00005145-30-agustos-afis.jpg', '00005145.jpg'),
        ('galata', '00005191', '00005191-30-agustos-kutlama.jpg', '00005191.jpg'),
        ('galata', '00005203', '00005203-30-agustos-toplanti-1.jpg', '00005203.jpg'),
        ('galata', '00005204', '00005204-30-agustos-toplanti-2.jpg', '00005204.jpg'),
        ('galata', '00005205', '00005205-30-agustos-toplanti-3.jpg', '00005205.jpg'),
        ('galata', '00005208', '00005208-30-agustos-toplanti-4.jpg', '00005208.jpg'),
        ('galata', '00005210', '00005210-30-agustos-toplanti-5.jpg', '00005210.jpg'),
        ('galata', '00005212', '00005212-30-agustos-toplanti-6.jpg', '00005212.jpg'),
        ('galata', '00005215', '00005215-30-agustos-toplanti-7.jpg', '00005215.jpg'),
    ],
    '2026-09': [
        ('galata', '00005281', '00005281-pinar-pirim-egitim-afis.jpg', '00005281.jpg'),
        ('galata', '00005288', '00005288-eylul-toplanti-1.jpg', '00005288.jpg'),
        ('galata', '00005290', '00005290-eylul-toplanti-2.jpg', '00005290.jpg'),
        ('galata', '00005291', '00005291-eylul-toplanti-3.jpg', '00005291.jpg'),
        ('galata', '00005292', '00005292-eylul-toplanti-4.jpg', '00005292.jpg'),
        ('galata', '00005293', '00005293-eylul-toplanti-5.jpg', '00005293.jpg'),
        ('galata', '00005294', '00005294-eylul-toplanti-6.jpg', '00005294.jpg'),
        ('galata', '00005382', '00005382-engelli-puseti-teslimi.jpg', '00005382.jpg'),
        ('galata', '00005346', '00005346-kacuv-afis.jpg', '00005346.jpg'),
        ('galata', '00005393', '00005393-kacuv-toplanti-1.jpg', '00005393.jpg'),
        ('galata', '00005394', '00005394-kacuv-toplanti-2.jpg', '00005394.jpg'),
        ('galata', '00005395', '00005395-kacuv-toplanti-3.jpg', '00005395.jpg'),
        ('galata', '00005396', '00005396-kacuv-toplanti-4.jpg', '00005396.jpg'),
        ('galata', '00005400', '00005400-kacuv-toplanti-5.jpg', '00005400.jpg'),
        ('galata', '00005404', '00005404-kacuv-toplanti-6.jpg', '00005404.jpg'),
        ('galata', '00005408', '00005408-kacuv-toplanti-7.jpg', '00005408.jpg'),
        ('galata', '00005409', '00005409-kacuv-toplanti-8.jpg', '00005409.jpg'),
        ('galata', '00005321', '00005321-gulsen-tuncer-vefa-1.jpg', '00005321.jpg'),
        ('galata', '00005322', '00005322-gulsen-tuncer-vefa-2.jpg', '00005322.jpg'),
        ('galata', '00005323', '00005323-gulsen-tuncer-vefa-3.jpg', '00005323.jpg'),
        ('galata', '00005275', '00005275-okcumusa-ilkokulu-vefa.jpg', '00005275.jpg'),
        ('galata', '00005353', '00005353-nostalji-23-eylul-2019.jpg', '00005353.jpg'),
        ('galata', '00005340', '00005340-baris-gunu-mesaji.jpg', '00005340.jpg'),
        ('bulten', '00003031', 'kitap_beyoglu_eski_yeni.jpg', None),
    ],
    '2026-10': [
        ('galata', '00005362', '00005362-ryla-egiticinin-egitimi-afis.jpg', '00005362.jpg'),
        ('galata', '00005466', '00005466-ryla-egitim-1.jpg', '00005466.jpg'),
        ('galata', '00005470', '00005470-ryla-egitim-2.jpg', '00005470.jpg'),
        ('galata', '00005476', '00005476-ryla-egitim-3.jpg', '00005476.jpg'),
        ('galata', '00005485', '00005485-ryla-egitim-4.jpg', '00005485.jpg'),
        ('galata', '00005509', '00005509-ryla-egitim-5.jpg', '00005509.jpg'),
        ('galata', '00005526', '00005526-ryla-egitim-6.jpg', '00005526.jpg'),
        ('galata', '00005528', '00005528-ryla-egitim-7.jpg', '00005528.jpg'),
        ('galata', '00005535', '00005535-ryla-egitim-8.jpg', '00005535.jpg'),
        ('galata', '00005543', '00005543-ryla-egitim-9.jpg', '00005543.jpg'),
        ('galata', '00005488', '00005488-tekerlekli-sandalye-teslim.jpg', '00005488.jpg'),
        ('galata', '00005624', '00005624-macahel-yardimi-1.jpg', '00005624.jpg'),
        ('galata', '00005625', '00005625-macahel-yardimi-2.jpg', '00005625.jpg'),
        ('galata', '00005626', '00005626-macahel-yardimi-3.jpg', '00005626.jpg'),
        ('galata', '00005627', '00005627-macahel-yardimi-4.jpg', '00005627.jpg'),
        ('galata', '00005551', '00005551-sirapinar-sosyal-1.jpg', '00005551.jpg'),
        ('galata', '00005553', '00005553-sirapinar-sosyal-2.jpg', '00005553.jpg'),
        ('galata', '00005563', '00005563-sirapinar-sosyal-3.jpg', '00005563.jpg'),
        ('galata', '00005580', '00005580-sirapinar-sosyal-4.jpg', '00005580.jpg'),
        ('galata', '00005610', '00005610-sirapinar-sosyal-5.jpg', '00005610.jpg'),
        ('galata', '00005615', '00005615-sirapinar-sosyal-6.jpg', '00005615.jpg'),
        ('galata', '00005619', '00005619-sirapinar-sosyal-7.jpg', '00005619.jpg'),
        ('galata', '00005659', '00005659-asamble-afis.jpg', '00005659.jpg'),
        ('galata', '00005668', '00005668-asamble-toplanti-1.jpg', '00005668.jpg'),
        ('galata', '00005669', '00005669-asamble-toplanti-2.jpg', '00005669.jpg'),
        ('galata', '00005670', '00005670-asamble-toplanti-3.jpg', '00005670.jpg'),
        ('galata', '00005671', '00005671-asamble-toplanti-4.jpg', '00005671.jpg'),
        ('galata', '00005673', '00005673-asamble-toplanti-5.jpg', '00005673.jpg'),
        ('galata', '00005695', '00005695-cumhuriyet-sibel-usanma-afis.jpg', '00005695.jpg'),
        ('galata', '00005690', '00005690-balat-gezisi-nostalji-1.jpg', '00005690.jpg'),
        ('galata', '00005692', '00005692-balat-gezisi-nostalji-2.jpg', '00005692.jpg'),
        ('galata', '00005693', '00005693-balat-gezisi-nostalji-3.jpg', '00005693.jpg'),
        ('galata', '00005370', '00005370-ryla-2025-nostalji.jpg', '00005370.jpg'),
        ('galata', '00005650', '00005650-sunay-akin-etkinlik-afis.jpg', '00005650.jpg'),
    ]
}

def extract_curated():
    print("=== Selective Photo & Asset Extractor ===")
    print(f"Project root: {PROJECT_ROOT}")
    
    os.makedirs(BRAND_DIR, exist_ok=True)
    for m in PHOTO_MAPPINGS.keys():
        os.makedirs(os.path.join(PHOTOS_DIR, m), exist_ok=True)
        
    # Open zip files
    with zipfile.ZipFile(ZIP_GALATA_RK, 'r') as z_galata, \
         zipfile.ZipFile(ZIP_BULTEN, 'r') as z_bulten:
         
        galata_names = z_galata.namelist()
        bulten_names = z_bulten.namelist()
        
        # 1. Extract brand assets from bulten zip
        print("\n[1/3] Extracting brand assets...")
        brand_files = [
            ('00003004-PHOTO-2026-10-28-10-07-39.jpg', 'theme-2026-2027.jpg'),
            ('00003029-PHOTO-2026-10-28-10-17-13.jpg', 'rotary-logos.jpg'),
            ('00003026-Galata RK (4).pdf', 'galata-rk-vector.pdf'),
        ]
        for src_name, dst_name in brand_files:
            if src_name in bulten_names:
                dst_path = os.path.join(BRAND_DIR, dst_name)
                with open(dst_path, 'wb') as f:
                    f.write(z_bulten.read(src_name))
                print(f"  ✓ Brand asset: {dst_name} ({os.path.getsize(dst_path)} bytes)")
            else:
                print(f"  ✗ Missing brand asset in bulten zip: {src_name}")

        # Extract Sevilay Aksel President portrait from high-res meeting photo
        # Photo 00005290 / 00005288 is Sevilay Aksel at Grand Hyatt meeting
        sevilay_photo_name = None
        for n in galata_names:
            if '00005288' in n or '00005290' in n:
                sevilay_photo_name = n
                break
        if sevilay_photo_name:
            sevilay_bytes = z_galata.read(sevilay_photo_name)
            for m in PHOTO_MAPPINGS.keys():
                target_portrait = os.path.join(PHOTOS_DIR, m, 'baskan_sevilay_aksel.jpg')
                with open(target_portrait, 'wb') as f:
                    f.write(sevilay_bytes)
            print(f"  ✓ President Sevilay Aksel portrait deployed to all months ({len(sevilay_bytes)} bytes)")

        # 2. Extract issue photos month by month
        print("\n[2/3] Extracting curated monthly photos...")
        total_extracted = 0
        for month, items in PHOTO_MAPPINGS.items():
            month_dir = os.path.join(PHOTOS_DIR, month)
            print(f"\nProcessing {month} ({len(items)} items)...")
            for zip_src, prefix, target_name, alias in items:
                source_z = z_galata if zip_src == 'galata' else z_bulten
                source_names = galata_names if zip_src == 'galata' else bulten_names
                
                # Match prefix in zip
                matching = [n for n in source_names if prefix in n]
                if not matching:
                    print(f"  ✗ Not found for prefix {prefix} in {zip_src} zip")
                    continue
                
                actual_name = matching[0]
                data = source_z.read(actual_name)
                
                # Write only canonical filename used by data/issues/*.json (no duplicate copies)
                canonical_name = alias if alias else target_name
                canonical_file = os.path.join(month_dir, canonical_name)
                with open(canonical_file, 'wb') as f:
                    f.write(data)
                            
                total_extracted += 1
                print(f"  ✓ [{month}] {prefix} -> {canonical_name} ({len(data)} bytes)")
                
        print(f"\n[3/3] Successfully extracted {total_extracted} curated photos.")
        print(f"Disk hygiene maintained: 0 temporary zip extractions on disk.")

if __name__ == '__main__':
    extract_curated()
