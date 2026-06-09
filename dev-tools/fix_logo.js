const fs = require('fs');
const path = require('path');

const imagePath = 'C:/Users/SraJu/.gemini/antigravity/brain/5e48ed26-f4b4-43c5-8512-ad2c307743e7/media__1780526004829.png';
const htmlPath = 'c:/Users/SraJu/Desktop/sfx-journal-v3 (1).html';

try {
  // 1. Read binary image directly and convert to standard Base64
  if (!fs.existsSync(imagePath)) {
    console.error('Image source not found at:', imagePath);
    process.exit(1);
  }
  const base64Data = fs.readFileSync(imagePath).toString('base64');
  console.log('Correct Base64 length:', base64Data.length);
  console.log('Starts with:', base64Data.substring(0, 30));

  // 2. Read HTML File
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 3. Replace all base64 image sources that start with data:image/png;base64,
  // Using a regex to find src="data:image/png;base64,..."
  const regex = /src="data:image\/png;base64,[^"]*"/g;
  
  let matchesCount = 0;
  html = html.replace(regex, (match) => {
    matchesCount++;
    return `src="data:image/png;base64,${base64Data}"`;
  });

  console.log(`Replaced ${matchesCount} logo source(s) with correct Base64.`);

  // 4. Save HTML File
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML file fixed successfully!');

} catch (err) {
  console.error('Error fixing logo:', err);
  process.exit(1);
}
