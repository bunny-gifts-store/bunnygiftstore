import os

codes = [
    'AP01', 'BG01', 'BG02', 'BG03', 'BG04', 'BG05', 'BG06', 'BG07', 'BG08', 'BG09', 'BG10', 'BG11', 'BG12', 'BG13', 'BG14', 'BG15', 'BG16', 'BG17', 'BG18', 'BG19', 'BG20', 'BG21', 'BG22', 'BG23', 'BG24',
    'BR01', 'CH01', 'CH02', 'CH03', 'CH04', 'CL01', 'CO01', 'CO02', 'CO03', 'KC01', 'KC02', 'LA01', 'LL01', 'NB01', 'PKC03', 'PKC04', 'TU01'
]

images_dir = os.path.join(os.getcwd(), 'images')
os.makedirs(images_dir, exist_ok=True)

SVG_TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f3e8ff"/>
      <stop offset="100%" stop-color="#e9d5ff"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="32" fill="url(#g)"/>
  <rect x="16" y="16" width="368" height="268" rx="24" fill="rgba(255,255,255,0.85)" stroke="#8b5cf6" stroke-width="3"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="56" fill="#5b21b6" font-weight="800">{code}</text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#553c9a">Product Preview</text>
</svg>'''

for code in codes:
    svg = SVG_TEMPLATE.format(code=code)
    path = os.path.join(images_dir, f'{code}.svg')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)

print(f'Created {len(codes)} SVG files in {images_dir}')
