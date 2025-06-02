// Define the full set of characters
// Backslash and double quote are escaped for proper JavaScript string literal.
const ALL_CHARS = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz+-_(){}[]=/\\%.*:,;!¡?¿\"<>'°|♥#^ @";
// Define the maximum possible dimensions for the font matrices
// This is used to preserve pixels when dimensions are temporarily reduced.
const MAX_FONT_HEIGHT = 120;
const MAX_FONT_WIDTH = 70;

let devMode = false;
// Key for localStorage
const LOCAL_STORAGE_KEY = 'pixelFontEditorData';
// Initial font data structure (default state)
const DEFAULT_FONT_DATA = {
    "custom-font": { // This key can be customized if you want different font names
        Disabled: false,
        Name: "Custom Font",
        Height: 3, // Current displayed height
        Width: 3,  // Current displayed width
        CharacterWidths: {}, // New property to store per-character widths (derived/reset)
        PixelSpacing: 1, // New property for image generation pixel spacing
        // Character matrices will be stored here, always at MAX_FONT_HEIGHT x MAX_FONT_WIDTH
    }
};
let uniqueId2;
let uniqueId;
try{
    uniqueId = crypto.randomUUID();
}catch(e){
    uniqueId = `${Math.random() * 1000000}`
}
let fontData = JSON.parse(JSON.stringify(DEFAULT_FONT_DATA)); // Start with a deep copy of default
let currentFontKey = 'custom-font'; // Initialize with default font key
// DOM elements
const fontNameInputDiv = document.getElementById('font-name-input');
const fontIdentifierInputDiv = document.getElementById('font-identifier-input');
const characterListDiv = document.getElementById('characterList');
const specialCharacterListDiv = document.getElementById('specialCharacterList'); // New div for special characters
const fontHeightValueSpan = document.getElementById('fontHeightValue');
const fontWidthValueSpan = document.getElementById('fontWidthValue');
const decreaseHeightBtn = document.getElementById('decreaseHeight');
const increaseHeightBtn = document.getElementById('increaseHeight');
const decreaseWidthBtn = document.getElementById('decreaseWidth');
const increaseWidthBtn = document.getElementById('increaseWidth');
const pixelGridDiv = document.getElementById('pixelGrid');
const selectedCharDisplay = document.getElementById('selectedCharDisplay');
const exportButton = document.getElementById('exportButton');
const exportOutput = document.getElementById('exportOutput');
const importInput = document.getElementById('importInput');
const importButton = document.getElementById('importButton');
const deleteDataButton = document.getElementById('deleteDataButton'); // New delete button
const imageTextInput = document.getElementById('imageTextInput'); // Image generation input
const generateImageButton = document.getElementById('generateImageButton'); // Image generation button
const imageOutputContainer = document.getElementById('imageOutputContainer'); // Image output container
const imageOutputContainerDev = document.getElementById('imageOutputContainerDev'); // Image output container Dev
// New DOM elements for pixel spacing and reset character width
const decreaseCharWidthBtn = document.getElementById('decreaseCharWidth'); // For custom char width
const increaseCharWidthBtn = document.getElementById('increaseCharWidth'); // For custom char width
const fontCharWidthValueSpan = document.getElementById('fontCharWidthValue'); // For custom char width display
const decreasePixelSpacingBtn = document.getElementById('decreasePixelSpacing');
const increasePixelSpacingBtn = document.getElementById('increasePixelSpacing');
const pixelSpacingValueSpan = document.getElementById('pixelSpacingValue');
const resetCharWidthButton = document.getElementById('resetCharWidthButton');
const importErrorDebug = document.getElementById('importErrorDebug'); // Debug div for import errors
const hoverPreview = document.getElementById('hoverPreview');
const previewCharName = document.getElementById('previewCharName');
const previewGrid = document.getElementById('previewGrid');
let currentSelectedChar = null; // Stores the currently selected character string
let isPainting = false; // Flag for click-and-drag painting
let wasPainting = false;
let paintValue = null; // Stores whether we are painting 1 or null (0)
let importErrorTimeout; // To clear import error message
// --- Helper Functions ---
// Function to create an empty matrix of the MAX_FONT_HEIGHT x MAX_FONT_WIDTH
function createMaxSizedEmptyMatrix() {
    const matrix = [];
    for (let r = 0; r < MAX_FONT_HEIGHT; r++) {
        const row = [];
        for (let c = 0; c < MAX_FONT_WIDTH; c++) {
            row.push(null); // Use null for empty space (internally 0)
        }
        matrix.push(row);
    }
    return matrix;
}
// Function to render the character list
function renderCharacterList() {
    characterListDiv.innerHTML = ''; // Clear existing main list
    specialCharacterListDiv.innerHTML = ''; // Clear existing special list
    ALL_CHARS.split('').forEach(char => {
        const button = document.createElement('button');
        button.textContent = char === ' ' ? '[Space]' : (char === '"' ? '\"' : (char === '@' ? '[Empty]' : char));
        button.className = 'character-button';
        if (char === currentSelectedChar) {
            button.classList.add('selected');
        }
        button.classList.add('darkbuttonboxes');
        button.style.borderRadius = "10px"
        button.style.height = "41px"
        button.dataset.char = char; // Store the actual character
        button.addEventListener('click', () => selectCharacter(char));
        button.addEventListener('mouseover', (e) => showHoverPreview(e, char));
        button.addEventListener('mouseout', hideHoverPreview);
        if (char === ' ') {
            specialCharacterListDiv.appendChild(button); // Add space to its dedicated area
        }else if (char === '@') {
            specialCharacterListDiv.appendChild(button); // Add space to its dedicated area
        }else {
            characterListDiv.appendChild(button); // Add other chars to the main grid
        }
    });
}
// Function to get the content-based width of a character (trimmed to rightmost pixel)
function getContentBasedWidth(char) {
    const matrix = fontData[currentFontKey][char];
    if (!matrix) return fontData[currentFontKey].Width; // Default to global if matrix doesn't exist
    let maxFilledColIndex = -1;
    for (let r = 0; r < fontData[currentFontKey].Height; r++) {
        for (let c = 0; c < fontData[currentFontKey].Width; c++) { // Iterate up to global width for content check
            if (matrix[r] && matrix[r][c] === 1) {
                maxFilledColIndex = Math.max(maxFilledColIndex, c);
            }
        }
    }
    return (maxFilledColIndex !== -1) ? (maxFilledColIndex + 1) : fontData[currentFontKey].Width;
}
// Function to get the width for display/export/image generation
function getEffectiveCharWidthForRender(char) {
    // If a custom width is explicitly set (manually or derived from import)
    if (fontData[currentFontKey].CharacterWidths[char] !== undefined && fontData[currentFontKey].CharacterWidths[char] !== null) {
        return fontData[currentFontKey].CharacterWidths[char];
    }
    // Otherwise, use the global width for display/export (trimming happens only on export)
    return fontData[currentFontKey].Width;
}
function shiftMatrix(horizontal,vertical) {
    let charMatrix = fontData[currentFontKey][currentSelectedChar];
    if(!charMatrix) return;
    if(charMatrix.length == 0 || charMatrix[0].length == 0) return;
    let width = charMatrix[0].length;
    if(horizontal == "left") {
        charMatrix.forEach(a=>a.shift())
        charMatrix.forEach(a=>a.push(null));
    }
    if(horizontal == "right") {
        charMatrix.forEach(a=>a.pop())
        charMatrix.forEach(a=>a.unshift(null));
    }
    if(vertical == "up") {
        charMatrix.shift()
        charMatrix.push(Array(width).fill(null));
    }
    if(vertical == "down") {
        charMatrix.pop();
        charMatrix.unshift(Array(width).fill(null));
    }
    //console.log(`Width: ${width}`)
    //console.log(charMatrix.map(a=>a.join(",")).join("\n"))
    renderPixelGrid()
}
// Function to render the pixel grid for the selected character
function renderPixelGrid() {
    pixelGridDiv.innerHTML = ''; // Clear existing grid
    const currentHeight = fontData[currentFontKey].Height;
    // Use the effective width for the currently selected character's display
    const currentDisplayWidth = getEffectiveCharWidthForRender(currentSelectedChar);
    // Calculate optimal pixel cell size to fit within the right panel
    const rightPanelWidth = pixelGridDiv.parentElement.clientWidth; // Use clientWidth for inner width
    const maxCellWidth = Math.floor(rightPanelWidth / currentDisplayWidth); // Use currentDisplayWidth for calculation
    const pixelCellSize = Math.min(40, Math.max(10, maxCellWidth)); // Clamp between 10px and 40px
    // Set CSS grid columns dynamically based on currentDisplayWidth and calculated cell size
    pixelGridDiv.style.gridTemplateColumns = `repeat(${currentDisplayWidth}, ${pixelCellSize}px)`;
    let charMatrix = fontData[currentFontKey][currentSelectedChar];
    // Ensure the matrix for the current character exists and is max-sized
    
    if (!charMatrix || charMatrix.length !== MAX_FONT_HEIGHT || (charMatrix.length > 0 && charMatrix[0].length !== MAX_FONT_WIDTH)) {
        const oldMatrix = charMatrix;
        charMatrix = createMaxSizedEmptyMatrix();
        if (oldMatrix) {
            for (let r = 0; r < Math.min(MAX_FONT_HEIGHT, oldMatrix.length); r++) {
                for (let c = 0; c < Math.min(MAX_FONT_WIDTH, oldMatrix[r].length); c++) {
                    charMatrix[r][c] = oldMatrix[r][c];
                }
            }
        }
        fontData[currentFontKey][currentSelectedChar] = charMatrix;
    }
    // Render only the cells within the currentHeight and currentDisplayWidth
    for (let rIdx = 0; rIdx < currentHeight; rIdx++) {
        for (let cIdx = 0; cIdx < currentDisplayWidth; cIdx++) {
            const pixel = charMatrix[rIdx][cIdx];
            const cell = document.createElement('div');
            cell.className = 'pixel-cell';
            // Apply inline style for pixel size to override CSS variable if needed
            cell.style.width = `${pixelCellSize}px`;
            cell.style.height = `${pixelCellSize}px`;
            if (pixel === 1) {
                cell.classList.add('filled');
            }
            cell.dataset.row = rIdx;
            cell.dataset.col = cIdx;
            cell.addEventListener('mousedown', startPainting);
            pixelGridDiv.appendChild(cell);
        }
    }
    // Update the Character Width display to reflect the current character's custom width or global width
    fontCharWidthValueSpan.textContent = fontData[currentFontKey].CharacterWidths[currentSelectedChar] !== undefined ?
                                         fontData[currentFontKey].CharacterWidths[currentSelectedChar] :
                                         fontData[currentFontKey].Width;
    
    // Update Reset button color based on whether custom width is set
    if (fontData[currentFontKey].CharacterWidths[currentSelectedChar] !== undefined) {
        resetCharWidthButton.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        resetCharWidthButton.classList.add('bg-red-500', 'hover:bg-red-600');
    } else {
        resetCharWidthButton.classList.remove('bg-red-500', 'hover:bg-red-600');
        resetCharWidthButton.classList.add('bg-gray-500', 'hover:bg-gray-600');
    }
}
// Function to apply pixel state based on current paintValue
function applyPixelState(targetCell) {
    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);
    let charMatrix = fontData[currentFontKey][currentSelectedChar];
    // Ensure the pixel is within the currently displayed bounds
    // Note: We use MAX_FONT_WIDTH here for internal data modification, not currentDisplayWidth
    if (charMatrix && row >= 0 && row < fontData[currentFontKey].Height && col >= 0 && col < MAX_FONT_WIDTH) {
        // Only update if the current pixel value is different from the paintValue
        if (charMatrix[row][col] !== paintValue) {
            charMatrix[row][col] = paintValue;
            if (paintValue === 1) {
                targetCell.classList.add('filled');
            } else {
                targetCell.classList.remove('filled');
            }
            /*
            // After pixel change, re-evaluate if custom width is needed/changed
            const newContentWidth = getContentBasedWidth(currentSelectedChar);
            if (newContentWidth !== fontData[currentFontKey].Width) {
                // If content width is different from global, mark as custom
                fontData[currentFontKey].CharacterWidths[currentSelectedChar] = newContentWidth;
            } else {
                // If content width is same as global, remove custom mark
                //delete fontData[currentFontKey].CharacterWidths[currentSelectedChar];
            }
            */
            saveFontDataToLocalStorage(); // Save after each pixel change
            renderPixelGrid(); // Re-render to reflect potential width change and update button color
        }
    }
}
// --- Painting functions for click-and-drag ---
function startPainting(event) {
    // Only start painting if it's a left-click and the target is a pixel cell
    if (event.button === 0 && event.target.classList.contains('pixel-cell')) {
        isPainting = true;
        wasPainting = true;
        event.preventDefault(); // Prevent default browser drag behavior
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const charMatrix = fontData[currentFontKey][currentSelectedChar];
        // Determine the initial paint mode (paint 1s or paint 0s/nulls)
        if (charMatrix && row >= 0 && row < fontData[currentFontKey].Height && col >= 0 && col < MAX_FONT_WIDTH) { // Use MAX_FONT_WIDTH for internal check
            paintValue = (charMatrix[row][col] === 1) ? null : 1; // If clicked on filled, erase. If clicked on empty, fill.
        } else {
            paintValue = null; // Default to erase if outside bounds (shouldn't happen with current logic)
        }
        applyPixelState(event.target); // Apply the initial state to the clicked pixel
    }
}
// This function will be called by the global mousemove listener
function handleGlobalMouseMove(event) {
    if (isPainting) {
        event.preventDefault(); // Prevent default browser drag behavior during drag
        // Check if the mouse is currently over a pixel cell
        const targetCell = event.target.closest('.pixel-cell');
        if (targetCell) {
            applyPixelState(targetCell); // Apply current paint mode to hovered pixel
        }
    }else {
        if(event.srcElement && event.srcElement.classList.contains("character-button")) {
            if (event.pageX == null && event.clientX != null) {
                let eventDoc = (event.target && event.target.ownerDocument) || document;
                let doc = eventDoc.documentElement;
                let body = eventDoc.body;

                event.pageX = event.clientX +
                  (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                  (doc && doc.clientLeft || body && body.clientLeft || 0);
                event.pageY = event.clientY +
                  (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
                  (doc && doc.clientTop  || body && body.clientTop  || 0 );
            }

            hoverPreview.style.left = `${event.pageX - 80}px`;
            hoverPreview.style.top = `${event.pageY - 45}px`;
        }
    }
}
function stopPainting() {
    isPainting = false;
    //console.log(`isPainting: ${isPainting} | wasPainting: ${wasPainting}`)
    if(devMode && wasPainting) {
        wasPainting = false;
        generateImage(devMode);
    }
    paintValue = null; // Reset paintValue when mouse is released
}
// Attach global mouseup listener to stop painting anywhere on document
document.addEventListener('mouseup', stopPainting);
// Attach global mousemove listener once on load
document.addEventListener('mousemove', handleGlobalMouseMove);
// Function to select a character
function selectCharacter(char) {
    currentSelectedChar = char;
    // Display space character clearly, and handle double quote for display
    selectedCharDisplay.textContent = char === ' ' ? '[Space]' : (char === '"' ? '\"' : (char === '@' ? '[Empty]' : char));
    // Update selected button in the list
    document.querySelectorAll('.character-button').forEach(button => {
        button.classList.remove('selected');
        if (button.dataset.char === char) {
            button.classList.add('selected');
        }
    });
    // Render the pixel grid for the newly selected character
    renderPixelGrid();
}
// --- Dimension Update Functions ---
function updateFontHeight(delta) {
    let newHeight = fontData[currentFontKey].Height + delta;
    newHeight = Math.max(1, Math.min(MAX_FONT_HEIGHT, newHeight)); // Clamp between 1 and MAX_FONT_HEIGHT
    if (newHeight === fontData[currentFontKey].Height) return; // No change
    fontData[currentFontKey].Height = newHeight;
    fontHeightValueSpan.textContent = newHeight;
    // Re-render the current character's grid to reflect the new display height
    if (currentSelectedChar) {
        renderPixelGrid();
    }
    saveFontDataToLocalStorage(); // Save after dimension change
}
function updateFontWidth(delta) {
    let newWidth = fontData[currentFontKey].Width + delta;
    newWidth = Math.max(1, Math.min(MAX_FONT_WIDTH, newWidth)); // Clamp between 1 and MAX_FONT_WIDTH
    if (newWidth === fontData[currentFontKey].Width) return; // No change
    fontData[currentFontKey].Width = newWidth;
    fontWidthValueSpan.textContent = newWidth;
    // When global width changes, DO NOT reassess custom character widths
    // Custom widths should remain independent unless explicitly reset.
    // Re-render the current character's grid to reflect the new display width
    if (currentSelectedChar) {
        renderPixelGrid();
    }
    saveFontDataToLocalStorage(); // Save after dimension change
}
// --- Character Specific Width Update Function ---
function updateCharWidth(delta) {
    if (!currentSelectedChar) return;
    let currentCustomWidth = fontData[currentFontKey].CharacterWidths[currentSelectedChar];
    let newCharWidth;
    if (currentCustomWidth === undefined || currentCustomWidth === null) {
        // If no custom width, start from global width
        newCharWidth = fontData[currentFontKey].Width + delta;
    } else {
        newCharWidth = currentCustomWidth + delta;
    }
    newCharWidth = Math.max(0, Math.min(MAX_FONT_WIDTH, newCharWidth)); // Clamp between 1 and MAX_FONT_WIDTH
    // If the new custom width is the same as the global width, remove the custom entry
    // This effectively "resets" it to global width behavior
    /*
    if (newCharWidth === fontData[currentFontKey].Width) {
        //delete fontData[currentFontKey].CharacterWidths[currentSelectedChar];
    } else {
        fontData[currentFontKey].CharacterWidths[currentSelectedChar] = newCharWidth;
    }
    */
    fontData[currentFontKey].CharacterWidths[currentSelectedChar] = newCharWidth;
    fontCharWidthValueSpan.textContent = newCharWidth; // Update UI
    renderPixelGrid(); // Re-render grid to reflect new visual width and update button color
    saveFontDataToLocalStorage(); // Save changes
}
// --- Pixel Spacing Update Function ---
function updatePixelSpacing(delta) {
    let newSpacing = fontData[currentFontKey].PixelSpacing + delta;
    newSpacing = Math.max(0, Math.min(10, newSpacing)); // Clamp between 0 and 10
    if (newSpacing === fontData[currentFontKey].PixelSpacing) return;
    fontData[currentFontKey].PixelSpacing = newSpacing;
    pixelSpacingValueSpan.textContent = newSpacing;
    saveFontDataToLocalStorage(); // Save changes
}
// --- Reset Character Width Function ---
function resetCharacterWidth() {
    if (!currentSelectedChar) return;
    if (fontData[currentFontKey].CharacterWidths[currentSelectedChar] !== undefined) {
        delete fontData[currentFontKey].CharacterWidths[currentSelectedChar];
        saveFontDataToLocalStorage();
        renderPixelGrid(); // Re-render to reflect global width and update button color
    }
}
// --- Export/Import Logic ---
// Custom formatter for export to achieve horizontal arrays and `0` for null
function formatExportData(data,keepColumns = false) {
    let output = "{\n";
    const fontKey = Object.keys(data)[0]; // Assuming 'font3x3'
    const fontProps = data[fontKey];
    // Helper to check if a matrix has any filled pixels within its effective dimensions
    const hasFilledPixels = (matrix, height, width) => {
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (matrix[r][c] === 1) {
                    return true;
                }
            }
        }
        return false;
    };
    // Determine Case property
    let hasUpperCasePixels = false;
    let hasLowerCasePixels = false;
    ALL_CHARS.split('').forEach(char => {
        const matrix = fontProps[char];
        if (matrix) {
            // Use fontProps.Height and Width for checking actual displayed content
            if (hasFilledPixels(matrix, fontProps.Height, fontProps.Width)) {
                // Check if character is an uppercase letter (A-Z, Ñ)
                if (char.length === 1 && char.match(/[A-ZÑ]/)) {
                    hasUpperCasePixels = true;
                }
                // Check if character is a lowercase letter (a-z, ñ)
                else if (char.length === 1 && char.match(/[a-zñ]/)) {
                    hasLowerCasePixels = true;
                }
            }
        }
    });
    let caseValue = "none";
    if (hasUpperCasePixels && hasLowerCasePixels) {
        caseValue = "both";
    } else if (hasUpperCasePixels) {
        caseValue = "upper";
    } else if (hasLowerCasePixels) {
        caseValue = "lower";
    }
    let fontName = fontNameInputDiv.value;
    if(typeof fontName == "undefined" || fontName.length <= 1) {
        fontNameInputDiv.value = `Custom font ${fontProps.Height}px`;
    }else{
        let toCheck = fontNameInputDiv.value.replace(/[^a-z0-9- ]/gi,"");
        if(toCheck.length < 2) {
            fontNameInputDiv.value = `Custom font ${fontProps.Height}px`;
        }
    }
    function sanitizeIdentifier(str) {
        if (typeof str !== 'string') {
            return '';
        }
        let string = str.toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '');
        while(string.startsWith("-")) {
            string = string.slice(1);
        }
        while(string.endsWith("-")) {
            string = string.substring(0,string.length - 1);
        }
        return string;
    }
    //console.log("--- Initial State ---");
    //console.log("fontIdentifierInputDiv.value (initial):", fontIdentifierInputDiv.value);
    //console.log("fontNameInputDiv.value (initial):", fontNameInputDiv.value);
    //console.log("fontProps.Height:", fontProps.Height);
    //console.log("----------------------");
    let processedIdentifier = sanitizeIdentifier(fontIdentifierInputDiv.value);
    //console.log("Processed Identifier (after initial sanitization):", processedIdentifier);
    if (processedIdentifier.length < 4) {
        //console.log("Condition: Processed identifier length < 4 (is " + processedIdentifier.length + ")");
        let processedFontName = sanitizeIdentifier(fontNameInputDiv.value);
        //console.log("Processed Font Name (after sanitization):", processedFontName);
        if (processedFontName.length < 3) {
            //console.log("Condition: Processed fontName length < 3 (is " + processedFontName.length + "). Setting to 'custom-font-XXpx'.");
            fontIdentifierInputDiv.value = `custom-font-${fontProps.Height}px`;
        } else {
            //console.log("Condition: Processed fontName length >= 3. Using processed fontName.");
            fontIdentifierInputDiv.value = processedFontName;
        }
    } else {
        //console.log("Condition: Processed identifier length >= 4 (is " + processedIdentifier.length + "). Using processed identifier.");
        fontIdentifierInputDiv.value = processedIdentifier;
    }
    /*
    if(typeof fontIdentifierInputDiv.value != "undefined") {
        console.log(fontIdentifierInputDiv.value)
        fontIdentifierInputDiv.value = fontIdentifierInputDiv.value.toLowerCase().replace(/\s+/g,"-").replace(/^[a-z0-9-]/gi,"");
        console.log(fontIdentifierInputDiv.value)
    }
    if(fontIdentifierInputDiv.value.length < 3) {
        console.log("2")
        let toCheck = fontNameInputDiv.value.replace(/^a-z0-9-/gi,"");
        if(toCheck.length < 2) {
            fontIdentifierInputDiv.value = `custom-font-${fontProps.Height}px`;
        }else{
            fontIdentifierInputDiv.value = fontNameInputDiv.value.toLowerCase().replace(/^a-z0-9-/gi,"");
        }
    }else{
        console.log("1")
    }
    */
    let pixelSpacing = isNull(fontProps.PixelSpacing) ? 1 : fontProps.PixelSpacing;
    output += `  "${fontIdentifierInputDiv.value}": {\n`; // Start font key object
    output += `    "Disabled": ${typeof fontProps.Disabled != "boolean" ? false : fontProps.Disabled},\n`;
    output += `    "Name": "${fontNameInputDiv.value}",\n`;
    output += `    "Height": ${fontProps.Height},\n`;
    output += `    "Width": ${fontProps.Width},\n`;
    output += `    "PixelSpacing": ${pixelSpacing},\n`;
    output += `    "Case": "${caseValue}",\n`; // Add Case property here
    // Collect formatted character matrices to handle conditional inclusion and commas correctly
    const formattedCharMatrices = [];
    // Sort ALL_CHARS for consistent output order (optional, but good practice)
    const sortedChars = ALL_CHARS.split('')//.sort();
    sortedChars.forEach(char => {
        const matrix = fontProps[char];
        if (matrix) {
            // Determine the width for export (based on custom width or trimmed content)
            let exportMatrixWidth;
            if (fontProps.CharacterWidths[char] !== undefined && fontProps.CharacterWidths[char] !== null) {
                // If a custom width is set (manually or derived), use it for export
                exportMatrixWidth = fontProps.CharacterWidths[char];
            } else {
                // Otherwise, calculate trimmed width based on content or global width if empty
                if(keepColumns) {
                    exportMatrixWidth = fontData[currentFontKey].Width;
                }else{
                    exportMatrixWidth = getContentBasedWidth(char);
                }
            }
            // Slice each row to the calculated exportMatrixWidth
            let exportedMatrix = matrix.slice(0, fontProps.Height).map(row => {
                const newRow = row.slice(0, exportMatrixWidth);
                // Pad with nulls if the new width is larger than original slice
                while (newRow.length < exportMatrixWidth) {
                    newRow.push(null);
                }
                return newRow;
            });
            // --- Conditional inclusion for lowercase letters ---
            let includeInExport = true;
            if (char.length === 1 && char.match(/[a-zñ]/)) { // Is a lowercase letter (including ñ)
                if (!hasFilledPixels(exportedMatrix, exportedMatrix.length, exportedMatrix[0] ? exportedMatrix[0].length : 0)) {
                    includeInExport = false; // Only include if it has content
                }
            }
            if (includeInExport) {
                // Handle escaping for the character key itself for JSON output
                let charKey = char;
                if (char === '"') {
                    charKey = '\\"';
                } else if (char === '\\') { // Escape literal backslash
                    charKey = '\\\\';
                }
                let charMatrixString = `    "${charKey}": [\n`;
                exportedMatrix.forEach((row, rowIndex) => {
                    const formattedRow = row.map(cell => cell === 1 ? '1' : '0').join(',');
                    charMatrixString += `      [${formattedRow}]${rowIndex < exportedMatrix.length - 1 ? ',' : ''}\n`;
                });
                charMatrixString += `    ]`;
                formattedCharMatrices.push(charMatrixString);
            }
        }
    });
    let formattedCharCustomWidths = [];
    if(fontProps.CharacterWidths != undefined && fontProps.CharacterWidths != null) {
        for(let customCharKey of Object.keys(fontProps.CharacterWidths)) {
            let charKey = customCharKey;
            if (customCharKey === '"') {
                charKey = '\\"';
            } else if (customCharKey === '\\') { // Escape literal backslash
                charKey = '\\\\';
            }
            let customWidth = fontProps.CharacterWidths[charKey];
            if(typeof customWidth != "undefined") {
                formattedCharCustomWidths.push(`      "${charKey}": ${customWidth}`);
            }
        }
    }
    // No "Padding" section in export anymore
    output += formattedCharMatrices.join(',\n'); // Join all character matrix strings with commas
    if(formattedCharCustomWidths.length != 0) {
        output += `,\n    "CharacterWidths": {\n`;
        output += formattedCharCustomWidths.join(',\n');
        output += `\n    }`;
    }
    output += "\n  }\n"; // Close font key object
    output += "}"; // Close main object
    return output;
}
function getMostRepeatedChars(charCounts) {
    let maxCount = -1; // Initialize with a value lower than any possible count
    let mostRepeated = []; // Array to store characters with the max count

    // Step 1: Find the maximum count
    for (const char in charCounts) {
        if (Object.prototype.hasOwnProperty.call(charCounts, char)) {
            const count = charCounts[char];
            if (count > maxCount) {
                maxCount = count;
            }
        }
    }

    // Handle empty object case
    if (maxCount === -1) {
        return [];
    }

    // Step 2: Collect all characters that match the maximum count
    for (const char in charCounts) {
        if (Object.prototype.hasOwnProperty.call(charCounts, char)) {
            if (charCounts[char] === maxCount) {
                mostRepeated.push(char);
            }
        }
    }

    return mostRepeated;
}
function loadCounter() {
    let href = window.location.href;
    if(!href.includes(atob("YWxvbnNvYWxpYWdhLmdpdGh1Yi5pbw=="))) return;
    let link = atob("aHR0cHM6Ly9hbG9uc29hcGkuZGlzY2xvdWQuYXBwL2NvdW50ZXI/c2l0ZT08c2l0ZT4ma2V5PTxrZXk+")
     .replace(/<site>/g,"font-creator").replace(/<key>/g,"KEY-A");
    let counter = document.getElementById("visitor-counter");
    //console.log(link)
    if(counter) {
      $.ajax({
        url: link,
        type: "GET", /* or type:"GET" or type:"PUT" */
        dataType: "json",
        data: {
        },
        success: function (result) {
          if(isNaN(result))
            document.getElementById("counter-amount").innerHTML = "Click to return!";
          else document.getElementById("counter-amount").innerHTML = `Visits: ${result}`;
        },
        error: function (e) {
          times++;
          document.getElementById("counter-amount").innerHTML = "Click to return!";
          if(times <= 1) {
           setTimeout(()=>{
             loadCounter();
           },1000*10);
          }
        }
      });
    }
}
// Function to import data
function importData(dataToImport) { // Named function for import
    clearTimeout(importErrorTimeout); // Clear any existing timeout
    importErrorDebug.style.display = 'none'; // Hide previous error
    try {
        let loadingFromStorage = false;
        let importedString = importInput.value;
        if(typeof dataToImport != "undefined" && typeof dataToImport == "string") {
            importedString = dataToImport;
            loadingFromStorage = true;
        }
        const parsedData = JSON.parse(importedString);
        const fontKey = Object.keys(parsedData)[0];
        if(devMode) {
            if (!fontKey || !parsedData[fontKey] || typeof parsedData[fontKey].Height === 'undefined') {
                throw new Error("Invalid font data structure: Missing font key or Height.");
            }
        }else{
            if (!fontKey || !parsedData[fontKey] || typeof parsedData[fontKey].Height === 'undefined' || typeof parsedData[fontKey].Width === 'undefined') {
                throw new Error("Invalid font data structure: Missing font key, Height, or Width.");
            }
        }
        currentFontKey = fontKey; // Set the current font key
        // Deep copy to ensure no reference issues
        const importedFontData = JSON.parse(JSON.stringify(parsedData));
        // Initialize CharacterWidths as an empty object for new derived widths
        fontData = {
            [currentFontKey]: {
                Disabled: typeof importedFontData[currentFontKey].Disabled != "boolean" ? false : importedFontData[currentFontKey].Disabled,
                Name: importedFontData[currentFontKey].Name,
                Height: Math.min(MAX_FONT_HEIGHT, importedFontData[currentFontKey].Height), // Clamp imported height
                Width: Math.min(MAX_FONT_WIDTH, importedFontData[currentFontKey].Width),   // Clamp imported width
                CharacterWidths: {}, // Initialize empty, will be populated based on imported content
                PixelSpacing: importedFontData[currentFontKey].PixelSpacing || 1, // Load PixelSpacing
            }
        };
        fontNameInputDiv.value = importedFontData[currentFontKey].Name;
        fontIdentifierInputDiv.value = fontKey;
        let charWidths = importedFontData[currentFontKey].CharacterWidths;
        if(typeof importedFontData[currentFontKey].Width == 'undefined') {
            let toGetMostWidth = {};
            "ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz".split('').forEach(char => {
                const importedCharMatrix = importedFontData[currentFontKey][char];
                if (importedCharMatrix && Array.isArray(importedCharMatrix)) {
                    let maxWidth = 0;
                    for (let r = 0; r < Math.min(MAX_FONT_HEIGHT, importedCharMatrix.length); r++) {
                        if (Array.isArray(importedCharMatrix[r])) {
                            maxWidth = Math.max(maxWidth , importedCharMatrix[r].length);
                        }
                    }
                    if(typeof toGetMostWidth[`${maxWidth}`] == "undefined") {
                        toGetMostWidth[`${maxWidth}`] = 0;
                    }
                    toGetMostWidth[`${maxWidth}`] = toGetMostWidth[`${maxWidth}`] + 1;
                }
            });
            let mostLengthRepeated = getMostRepeatedChars(toGetMostWidth);
            if(mostLengthRepeated.length == 0) {
                importedFontData[currentFontKey].Width = 5
            }else if(mostLengthRepeated.length == 1) {
                importedFontData[currentFontKey].Width = mostLengthRepeated[0]
            }else{
                importedFontData[currentFontKey].Width = mostLengthRepeated[0]
            }
            fontData[currentFontKey].Width = Math.min(MAX_FONT_WIDTH, importedFontData[currentFontKey].Width)
        }
        //console.log(`Loading ALL_CHARS => [${ALL_CHARS.split('').join("")}]`)
        //console.log(`Width: ${fontData[currentFontKey].Width} | Height: ${fontData[currentFontKey].Height}`);
        // Load all characters from ALL_CHARS, using imported data if available, else empty matrix
        ALL_CHARS.split('').forEach(char => {
            // Handle escaped double quote and backslash for lookup in imported data
            let charLookupKey = char;
            /*
            if (char === '"') {
                charLookupKey = '\\"';
            } else if (char === '\\') {
                charLookupKey = '\\\\';
            }
            */
            //console.log(`Loading char: ${char} => charLookupKey: ${charLookupKey}`)
            // Get imported matrix, or undefined if not present
            const importedCharMatrix = importedFontData[currentFontKey][charLookupKey];
            const newMaxMatrix = createMaxSizedEmptyMatrix(); // Always start with a full MAX_FONT_HEIGHT x MAX_FONT_WIDTH empty matrix
            if (importedCharMatrix && Array.isArray(importedCharMatrix)) {
                //console.log("1");
                if(!isNull(charWidths) && !isNull(charWidths[charLookupKey])) {
                    //console.log(`Custom width for ${charLookupKey}: ${charWidths[charLookupKey]}`);
                    fontData[currentFontKey].CharacterWidths[charLookupKey] = charWidths[charLookupKey];

                    for (let r = 0; r < Math.min(MAX_FONT_HEIGHT, importedCharMatrix.length); r++) {
                        if (Array.isArray(importedCharMatrix[r])) {
                            for (let c = 0; c < Math.min(MAX_FONT_WIDTH, charWidths[charLookupKey]); c++) {
                                // Convert '0' (from number) to null for internal representation
                                newMaxMatrix[r][c] = (importedCharMatrix[r][c] === 0 || importedCharMatrix[r][c] === null) ? null : 1;
                                //Loading max and custom
                            }
                        }
                    }
                }else{
                    //console.log(`No custom width for ${charLookupKey}`);
                    let maxColIndexInImported = -1;
                    // Copy imported pixels into the new max-sized matrix
                    for (let r = 0; r < Math.min(MAX_FONT_HEIGHT, importedCharMatrix.length); r++) {
                        if (Array.isArray(importedCharMatrix[r])) {
                            for (let c = 0; c < Math.min(MAX_FONT_WIDTH, importedCharMatrix[r].length); c++) {
                                // Convert '0' (from number) to null for internal representation
                                newMaxMatrix[r][c] = (importedCharMatrix[r][c] === 0 || importedCharMatrix[r][c] === null) ? null : 1;
                                maxColIndexInImported = Math.max(maxColIndexInImported, c);
                                //Loading max and custom
                            }
                        }
                    }
                    // Set the custom width based on the imported content's max length if different from global
                    const derivedWidth = (maxColIndexInImported !== -1) ? (maxColIndexInImported + 1) : fontData[currentFontKey].Width;
                    if (derivedWidth !== fontData[currentFontKey].Width) {
                        fontData[currentFontKey].CharacterWidths[charLookupKey] = derivedWidth;
                    }
                }
                /*
                if (derivedWidth !== fontData[currentFontKey].Width) {
                    fontData[currentFontKey].CharacterWidths[char] = derivedWidth;
                } else {
                    delete fontData[currentFontKey].CharacterWidths[char]; // Ensure it's not marked custom
                }
                */
            } else {
                //console.log("2");
                // If character not in imported data, its effective width defaults to global width, so ensure not marked custom
                delete fontData[currentFontKey].CharacterWidths[charLookupKey];
            }
            //console.log("3");
            fontData[currentFontKey][charLookupKey] = newMaxMatrix;
            //console.log("4");
        });
        // Update UI elements to reflect imported dimensions
        fontHeightValueSpan.textContent = fontData[currentFontKey].Height;
        fontWidthValueSpan.textContent = fontData[currentFontKey].Width;
        pixelSpacingValueSpan.textContent = isNull(fontData[currentFontKey].PixelSpacing) ? 1 : fontData[currentFontKey].PixelSpacing; // Update pixel spacing UI
        //console.log("5");
        renderCharacterList();
        if (currentSelectedChar) {
            selectCharacter(currentSelectedChar); // Re-select to render grid
        } else if (ALL_CHARS.length > 0) {
            selectCharacter(ALL_CHARS[0]); // Select first if nothing was selected
        }
        if(devMode) generateImage(devMode);
        //console.log("6");
        if(!loadingFromStorage) {
            //alert('Font data imported successfully!');
            alertMessage(`✅ Font data imported successfully!`)
        }else{
            alertMessage(`✅ Succesfully loaded last workspace!`)
            //mportErrorDebug.textContent = `Succesfully loaded last modification.`;
            //mportErrorDebug.style.display = 'block';
            //mportErrorTimeout = setTimeout(() => {
            //   importErrorDebug.style.display = 'none';
            //, 5000); // Hide after 10 seconds
        }
        exportOutput.value = ''; // Clear export output after import
        saveFontDataToLocalStorage(); // Save after successful import
    } catch (error) {
        //console.error("Error importing font data:", error);
        importErrorDebug.textContent = `Import Error: ${error.message}`;
        importErrorDebug.style.display = 'block';
        importErrorTimeout = setTimeout(() => {
            importErrorDebug.style.display = 'none';
        }, 10000); // Hide after 10 seconds
    }
}
let alertTimeout;
function alertMessage(text = `Nothing here..`) {
  if(alertTimeout) {
    clearTimeout(alertTimeout);
    var sb = document.getElementById("snackbar");
    sb.className = sb.className.replace("show", "");
  }
  var sb = document.getElementById("snackbar");

  //this is where the class name will be added & removed to activate the css
  sb.className = "show";
  sb.innerText = `${text}`

  alertTimeout = setTimeout(()=>{ sb.className = sb.className.replace("show", ""); }, 3000);
}
// --- Local Storage Functions ---
function saveFontDataToLocalStorage() {
    try {
        const exportedData = formatExportData(fontData,true);
        localStorage.setItem(LOCAL_STORAGE_KEY, exportedData);
        
        //localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fontData));
        
        //console.log("Font data saved to localStorage."); // For internal debugging
    } catch (e) {
        console.error("Error saving to localStorage:", e);
        alert("Could not save data to your browser's local storage.");
    }
}
function loadFontDataFromLocalStorage() {
    try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            importData(savedData);
            return;
            const parsedData = JSON.parse(savedData);
            const fontKey = Object.keys(parsedData)[0];
            if (fontKey && parsedData[fontKey] && typeof parsedData[fontKey].Height !== 'undefined' && typeof parsedData[fontKey].Width !== 'undefined') {
                currentFontKey = fontKey; // Set the current font key
                // Deep copy to ensure no reference issues
                const loadedFontData = JSON.parse(JSON.stringify(parsedData));
                fontData = {
                    [currentFontKey]: {
                        Disabled: loadedFontData[currentFontKey].Disabled,
                        Name: loadedFontData[currentFontKey].Name,
                        Height: Math.min(MAX_FONT_HEIGHT, loadedFontData[currentFontKey].Height),
                        Width: Math.min(MAX_FONT_WIDTH, loadedFontData[currentFontKey].Width),
                        CharacterWidths: {}, // Initialize empty, will be populated based on loaded content
                        PixelSpacing: loadedFontData[currentFontKey].PixelSpacing || 1, // Load PixelSpacing
                    }
                };
                ALL_CHARS.split('').forEach(char => {
                    let charLookupKey = char;
                    if (char === '"') {
                        charLookupKey = '\\"';
                    } else if (char === '\\') {
                        charLookupKey = '\\\\';
                    }
                    const loadedCharMatrix = loadedFontData[currentFontKey][charLookupKey];
                    const newMaxMatrix = createMaxSizedEmptyMatrix();
                    if (loadedCharMatrix && Array.isArray(loadedCharMatrix)) {
                        let maxColIndexInLoaded = -1;
                        for (let r = 0; r < Math.min(MAX_FONT_HEIGHT, loadedCharMatrix.length); r++) {
                            if (Array.isArray(loadedCharMatrix[r])) {
                                for (let c = 0; c < Math.min(MAX_FONT_WIDTH, loadedCharMatrix[r].length); c++) {
                                    newMaxMatrix[r][c] = (loadedCharMatrix[r][c] === 0 || loadedCharMatrix[r][c] === null) ? null : 1;
                                    if (newMaxMatrix[r][c] === 1) {
                                        maxColIndexInLoaded = Math.max(maxColIndexInLoaded, c);
                                    }
                                }
                            }
                        }
                        // Store the derived width for this character
                        const derivedWidth = (maxColIndexInLoaded !== -1) ? (maxColIndexInLoaded + 1) : fontData[currentFontKey].Width;
                        if (derivedWidth !== fontData[currentFontKey].Width) {
                            fontData[currentFontKey].CharacterWidths[char] = derivedWidth;
                        } else {
                            delete fontData[currentFontKey].CharacterWidths[char];
                        }
                    } else {
                        // If character not in loaded data, its effective width defaults to global width, so ensure not marked custom
                        delete fontData[currentFontKey].CharacterWidths[char];
                    }
                    fontData[currentFontKey][char] = newMaxMatrix;
                });
                fontHeightValueSpan.textContent = fontData[currentFontKey].Height;
                fontWidthValueSpan.textContent = fontData[currentFontKey].Width;
                pixelSpacingValueSpan.textContent = fontData[currentFontKey].PixelSpacing; // Update pixel spacing UI
                //console.log("Font data loaded from localStorage."); // For internal debugging
            }
        }
    } catch (e) {
        console.error("Error loading from localStorage:", e);
        // If loading fails, just proceed with default fontData
        fontData = JSON.parse(JSON.stringify(DEFAULT_FONT_DATA));
        alert("Could not load saved data. Starting with a fresh editor.");
    }
}// --- Reset Editor Function ---
function deleteMatrix() {
    if (confirm('Are you sure you want to delete this character matrix?\n\n⚠️ This action cannot be undone. ⚠️')) {
        if(typeof fontData[currentFontKey] == "undefined" || typeof fontData[currentFontKey][currentSelectedChar] == "undefined") {
            alert('You shouldn\'t read this message.\n\nHow you got this error?');
            return;
        }
        fontData[currentFontKey][currentSelectedChar] = createMaxSizedEmptyMatrix();
        saveFontDataToLocalStorage();
        renderPixelGrid()
        alert('Current character matrix was deleted!');
    }
}
// --- Reset Editor Function ---
function resetEditor() {
    if (confirm('Are you sure you want to delete all saved font data and restart? This action cannot be undone.\nReminder: Import text will not be deleted.\n\n⚠️ This action cannot be undone. ⚠️')) {
        fontData = JSON.parse(JSON.stringify(DEFAULT_FONT_DATA)); // Reset to default state
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear localStorage
        currentFontKey = 'custom-font'; // Reset font key to default
        initializeEditor(true); // Re-initialize the editor UI
        alert('All font data has been deleted and the editor has been reset.');
    }
}
// --- Hover Preview Functions ---
function showHoverPreview(event, char) {
    const charMatrix = fontData[currentFontKey][char];
    if (!charMatrix) return;
    previewCharName.textContent = char === ' ' ? '[Space]' : (char === '"' ? '\"' : (char === '@' ? '[Empty]' : char));
    previewGrid.innerHTML = ''; // Clear previous preview
    const currentHeight = fontData[currentFontKey].Height;
    // Use the effective width for the preview grid
    const currentWidth = getEffectiveCharWidthForRender(char);
    previewGrid.style.gridTemplateColumns = `repeat(${currentWidth}, 1fr)`;
    for (let rIdx = 0; rIdx < currentHeight; rIdx++) {
        for (let cIdx = 0; cIdx < currentWidth; cIdx++) {
            const pixel = charMatrix[rIdx][cIdx];
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            if (pixel === 1) {
                cell.classList.add('filled');
            }
            previewGrid.appendChild(cell);
        }
    }
    // Position the preview box relative to the hovered button

    //const buttonRect = event.target.getBoundingClientRect();
    //const leftPanelRect = characterListDiv.getBoundingClientRect(); // Use main list div for positioning reference
    
    // Position to the right of the button, adjust for scrolling
    // Test #1
    if (event.pageX == null && event.clientX != null) {
        let eventDoc = (event.target && event.target.ownerDocument) || document;
        let doc = eventDoc.documentElement;
        let body = eventDoc.body;

        event.pageX = event.clientX +
          (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
          (doc && doc.clientLeft || body && body.clientLeft || 0);
        event.pageY = event.clientY +
          (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
          (doc && doc.clientTop  || body && body.clientTop  || 0 );
    }
          
    hoverPreview.style.left = `${event.pageX - 110}px`;
    hoverPreview.style.top = `${event.pageY - 45}px`;
    //console.log("Moving hover!")

    // hoverPreview.style.left = `${buttonRect.right - leftPanelRect.left + 10 + 140}px`;
    // hoverPreview.style.top = `${buttonRect.top - leftPanelRect.top + 100}px`;
    hoverPreview.style.display = 'inline'; // Show the preview
}
function hideHoverPreview() {
    hoverPreview.style.display = 'none';
}
// --- Image Generation Function ---
function generateImage2() {
    const text = imageTextInput.value;
    if (!text) {
        imageOutputContainer.innerHTML = 'Please enter some text to generate an image.';
        return;
    }
    const fontProps = fontData[currentFontKey];
    const pixelSizeForImage = 10; // Base size of each pixel in the generated image
    const pixelSpacing = fontProps.PixelSpacing || 1; // Get current pixel spacing
    let totalImageWidth = 0;
    let totalImageHeight = fontProps.Height * pixelSizeForImage; // Height is fixed by font height
    // Calculate total width and collect character matrices to draw
    const charsToDraw = [];
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charMatrix = fontProps[char] || createMaxSizedEmptyMatrix(); // Get matrix or empty one
        
        // Get the effective width for rendering this specific character for image generation
        let charRenderWidth = getEffectiveCharWidthForRender(char);
        // Calculate the width occupied by this character including its internal pixel spacing
        const charOccupiedWidth = (charRenderWidth * pixelSizeForImage) + (charRenderWidth > 0 ? (charRenderWidth - 1) * pixelSpacing : 0);
        
        totalImageWidth += charOccupiedWidth;
        if (i < text.length - 1) { // Add spacing between characters
            totalImageWidth += pixelSpacing;
        }
        charsToDraw.push({ charMatrix, charRenderWidth });
    }
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = "preview-canvas";
    canvas.width = totalImageWidth;
    canvas.height = totalImageHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF'; // White background for the image
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let currentX = 0;
    ctx.fillStyle = '#4f46e5'; // Filled pixel color (indigo)
    charsToDraw.forEach(({ charMatrix, charRenderWidth }, index) => {
        for (let r = 0; r < fontProps.Height; r++) {
            for (let c = 0; c < charRenderWidth; c++) { // Draw up to charRenderWidth
                if (charMatrix[r] && charMatrix[r][c] === 1) {
                    // Position each pixel considering its own size and spacing
                    ctx.fillRect(currentX + c * (pixelSizeForImage + pixelSpacing), r * pixelSizeForImage, pixelSizeForImage, pixelSizeForImage);
                }
            }
        }
        // Advance currentX for the next character, including internal spacing and character spacing
        const charOccupiedWidth = (charRenderWidth * pixelSizeForImage) + (charRenderWidth > 0 ? (charRenderWidth - 1) * pixelSpacing : 0);
        currentX += charOccupiedWidth;
        if (index < charsToDraw.length - 1) { // Add spacing between characters
            currentX += pixelSpacing;
        }
    });
    imageOutputContainer.innerHTML = '';
    imageOutputContainer.appendChild(canvas);
    setTimeout(()=>{
        let previewCanvas = document.getElementById("preview-canvas");
        //previewCanvas.style.width = "100%"
        previewCanvas.width = canvas.parentElement.offsetWidth;
    },2500);
}
function isNull(value) {
    return value == undefined || value == null;
}
function generateImage() {
    //console.log(`Generating image.. Dev mode: ${devMode}`)
    let theContainer = devMode ? imageOutputContainerDev : imageOutputContainer
    const text = (devMode ? document.getElementById("inputText") : imageTextInput).value;
    if (!text) {
        theContainer.innerHTML = 'Please enter some text to generate an image.';
        return;
    }
    const fontProps = fontData[currentFontKey];
    const pixelSizeForImage = 10; // Size of each pixel
    const pixelSpacing = (isNull(fontProps.PixelSpacing) ? 1 : fontProps.PixelSpacing) * pixelSizeForImage; // Spacing BETWEEN CHARACTERS
    let totalImageWidth = 0;
    let totalImageHeight = fontProps.Height * pixelSizeForImage;
    const charsToDraw = [];
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if(char === "@") {
            const charMatrix = fontProps[char] || createMaxSizedEmptyMatrix();
            let charRenderWidth = getEffectiveCharWidthForRender(char);
            const charOccupiedWidth = charRenderWidth * pixelSizeForImage;
            totalImageWidth += charOccupiedWidth;
            totalImageWidth += pixelSpacing;
            /*
            if (i < text.length - 1) {
                totalImageWidth += pixelSpacing; // Only between characters
            }
            */
            charsToDraw.push({ charMatrix, charRenderWidth });
        }else{
            const charMatrix = fontProps[char] || createMaxSizedEmptyMatrix();
            let charRenderWidth = getEffectiveCharWidthForRender(char);
            const charOccupiedWidth = charRenderWidth * pixelSizeForImage;
            totalImageWidth += charOccupiedWidth;
            if (i < text.length - 1) {
                totalImageWidth += pixelSpacing; // Only between characters
            }
            charsToDraw.push({ charMatrix, charRenderWidth });
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = totalImageWidth;
    canvas.height = totalImageHeight;
    /*
    let additionalHeight = 0;
    if(totalImageWidth > 1600) {
        //anvas.style.maxWidth = "800px"
        canvas.style.height = `${25+additionalHeight}px`
    }else if(totalImageWidth > 700) {
        //anvas.style.maxWidth = "800px"
        canvas.style.height = `${30+additionalHeight}px`
    }else if(totalImageWidth > 550) {
        //anvas.style.maxWidth = "800px"
        canvas.style.height = `${40+additionalHeight}px`
    }else{
        canvas.style.height = `${50+additionalHeight}px`
    }
    */
    let additionalHeight = 0;
    
    if(totalImageWidth > 1600) {
        //anvas.style.maxWidth = "800px"
        canvas.style.width = `${1000}px`
    }else if(totalImageWidth > 700) {
        //anvas.style.maxWidth = "800px"
        canvas.style.width = `${650}px`
    }else if(totalImageWidth > 550) {
        //anvas.style.maxWidth = "800px"
        canvas.style.width = `${500}px`
    }else{
        canvas.style.width = `${500}px`
    }
    canvas.style.borderColor = "white"
    canvas.style.borderWidth = "5px"
    // canvas.style.minHeight = "50px"
    // canvas.style.maxHeight = "50px"
    // canvas.style.minWidth = "500px"
    canvas.style.imageRendering = "pixelated"
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let currentX = 0;
    ctx.fillStyle = '#4f46e5';
    charsToDraw.forEach(({ charMatrix, charRenderWidth }, index) => {
        for (let r = 0; r < fontProps.Height; r++) {
            for (let c = 0; c < charRenderWidth; c++) {
                if (charMatrix[r] && charMatrix[r][c] === 1) {
                    // Only use pixel size; no internal spacing
                    ctx.fillRect(currentX + c * pixelSizeForImage, r * pixelSizeForImage, pixelSizeForImage, pixelSizeForImage);
                }
            }
        }
        currentX += charRenderWidth * pixelSizeForImage;
        if (index < charsToDraw.length - 1) {
            currentX += pixelSpacing; // Spacing between characters
        }
    });
    theContainer.innerHTML = '';
    theContainer.appendChild(canvas);
}
// --- Event Listeners ---
decreaseHeightBtn.addEventListener('click', () => updateFontHeight(-1));
increaseHeightBtn.addEventListener('click', () => updateFontHeight(1));
decreaseWidthBtn.addEventListener('click', () => updateFontWidth(-1));
increaseWidthBtn.addEventListener('click', () => updateFontWidth(1));
decreaseCharWidthBtn.addEventListener('click', () => updateCharWidth(-1));
increaseCharWidthBtn.addEventListener('click', () => updateCharWidth(1));
decreasePixelSpacingBtn.addEventListener('click', () => updatePixelSpacing(-1));
increasePixelSpacingBtn.addEventListener('click', () => updatePixelSpacing(1));
resetCharWidthButton.addEventListener('click', resetCharacterWidth); // New listener for reset button
exportButton.addEventListener('click', () => {
    const exportedData = formatExportData(fontData);
    exportOutput.value = exportedData;
    try {
        navigator.clipboard.writeText(exportedData).then(() => {
            alert('Font data copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            alert('Font data generated, but failed to copy to clipboard. Please copy manually from the text area.');
        });
    } catch (err) {
        // Fallback for older browsers or security contexts
        console.error('navigator.clipboard not available, attempting old method:', err);
        // Select the text area and execute copy command
        exportOutput.select();
        exportOutput.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand('copy');
        alert('Font data generated and copied to clipboard! (Fallback method)');
    }
});
importButton.addEventListener('click', importData);
generateImageButton.addEventListener('click', generateImage);
deleteDataButton.addEventListener('dblclick', resetEditor);
// --- Initialization ---
function initializeEditor(isReset = false) {
    loadFontDataFromLocalStorage(); // Attempt to load saved data first
    // Ensure all characters have a max-sized matrix, even if not loaded from storage
    ALL_CHARS.split('').forEach(char => {
        if(isNull(fontData[currentFontKey][char])) {
            console.log(`Checking ${char}`)
            if(char == "@") {
                const m = [];
                for (let r = 0; r < MAX_FONT_HEIGHT; r++) {
                    m.push([]);
                }
                fontData[currentFontKey][char] = m;
                if(typeof fontData[currentFontKey].CharacterWidths == "undefined")
                    fontData[currentFontKey].CharacterWidths = {};
                fontData[currentFontKey].CharacterWidths["@"] = 0
            }else{
                fontData[currentFontKey][char] = createMaxSizedEmptyMatrix();
            }
        }
        // CharacterWidths are now populated by importData/loadFontDataFromLocalStorage
        // or when pixels are drawn/erased. No explicit initialization needed here.
    });
    renderCharacterList();
    // Select the first character by default if nothing is selected or loaded
    if (!currentSelectedChar && ALL_CHARS.length > 0) {
        selectCharacter(ALL_CHARS[0]);
    } else if (currentSelectedChar) {
        // If a character was already selected (e.g., after loading), re-select to refresh grid
        selectCharacter(currentSelectedChar);
    }
    // Ensure UI dimensions match loaded data (or default)
    fontHeightValueSpan.textContent = fontData[currentFontKey].Height;
    fontWidthValueSpan.textContent = fontData[currentFontKey].Width;
    pixelSpacingValueSpan.textContent = fontData[currentFontKey].PixelSpacing; // Initialize pixel spacing UI
    
    if((typeof isReset == "boolean" && !isReset) || typeof isReset != "event") {
        checkSite(window);
        toggleDarkmode();
        loadCounter();
        checkUnlockStatus();
    }
    generateImage(devMode);
}
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
// Call initializeEditor when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeEditor);
document.addEventListener('DOMContentLoaded', toggleDarkmode);
let unknown;
window.addEventListener('message', function(event){
    if(event.data.load == 96) {
        if(uniqueId == event.data.uuid) {
            uniqueId2 = event.data.uuid2;
        }//else console.log("[load] Different uuid1")
    }else if(event.data.key == 96) {
        if(uniqueId == event.data.uuid) {
            if(uniqueId2 == event.data.uuid2) {
                unknown = uniqueId;
                window.addEventListener('focus', function(event){
                    if(unknown == undefined) return
                    if (history.scrollRestoration) {
                      history.scrollRestoration = 'manual';
                    } else {
                      window.onbeforeunload = function () {
                          window.scrollTo(0, 0);
                      }
                    }
                    setTimeout(()=>checkUnlockStatus(),2500);
                },{once:true})
            }//else console.log("[key] Different uuid2")
        }//else console.log("[key] Different uuid1")
    }//else console.log("No load=96 or key=96")
});
async function checkUnlockStatus() {
        const unlockStatusElement = document.getElementById('unlock-features-div');
        // setInterval(()=>{
        //   unlockStatusElement.click();
        // },10);
        //const openAdsButton = document.getElementById('openAdsButton');
        try {
            const storedUnlockData = localStorage.getItem(`appUnlockDataFeature-${btoa("moveArrows")}`);
            if (!storedUnlockData) {
                return;
            }
            //let { unlockedUntil, signature } = JSON.parse(storedUnlockData);
            let json = {};
            try{
              json = JSON.parse(storedUnlockData);
            }catch(e) {
            }
            let { unlockedUntil, signature } = json;

            // Ensure data types are correct
            if (typeof unlockedUntil !== 'number' || typeof signature !== 'string') {
                localStorage.removeItem(`appUnlockDataFeature-${btoa("moveArrows")}`); // Clear invalid data/
                return;
            }
            // Recalculate the expected signature to check for tampering
            const expectedSignature = await generateSha256Hash(unlockedUntil + "WhatTheHellAreYouLookingForHere?");

            // Check if the signature matches AND if the timestamp is still valid
            const currentTime = Date.now();

            if (signature === expectedSignature && currentTime < unlockedUntil) {
                const remainingTimeMs = unlockedUntil - currentTime;
                const remainingHours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
                const remainingMinutes = Math.floor((remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
                unlockStatusElement.innerText = `UNLOCKED FEATURES! 🚀\r\nExpires in ${remainingHours}h ${remainingMinutes}m`;
                unlockStatusElement.style.backgroundColor = "rgb(128 255 103)"
                unlockStatusElement.style.fontWeight = "bold"
                unlockStatusElement.disabled = true;
                document.getElementById("matrix-move-div").style.display = null;
                // document.getElementById("button-internal-colored-corner-border-div").style.display = "inline-block";
                // document.getElementById("button-internal-gradient-border-div").style.display = "inline-block";
                unlockStatusElement.onclick = function(){
                    return false;
                };
                //console.warn("Already unlocked!");
                let time = 0;
                let a = setInterval(()=>{
                    if(time < 5) clap();
                    if(time > 10) {
                        clearInterval(a);
                        return;
                    }
                    customParty("👑 🔓 🗝️ 🧪".split(" "));
                    time++;
                },250);
                //confettiTime()
            } else {
                // Either signature mismatch (tampered) or unlock period expired
                if (signature !== expectedSignature) {
                    console.warn("Unlock data tampered with! Signature mismatch.");
                    // For a real application, you might want to log this to a server
                    // to detect and analyze tampering attempts.
                }
                localStorage.removeItem(`appUnlockDataFeature-${btoa("moveArrows")}`); // Clear invalid or expired data
                unlockStatusElement.textContent = '  Unlock features 🧪';
                //console.warn("Suspicious data, not unlocked.");
            }
        } catch (error) {
            //console.error("Error checking unlock status:", error);
            localStorage.removeItem(`appUnlockDataFeature-${btoa("moveArrows")}`); // Clear potentially corrupted data
            unlockStatusElement.textContent = '  Unlock features 🧪';
        }
        function customParty(emojis = [], time = 0) {
          const defaults = {
            spread: 360,
            ticks: 100,
            gravity: 0,
            decay: 0.94,
            startVelocity: 30,
          };
          function shoot(particleCount = 10) {
            confetti({
              ...defaults,
              particleCount: particleCount,
              scalar: 2,
              shapes: ["emoji"],
              shapeOptions: {
                emoji: {
                  value: emojis,
                },
              },
            });
          }
          if(time != 0) {
            const duration = time * 1 * 1000,
              animationEnd = Date.now() + duration;
            const interval = setInterval(function () {
            	const timeLeft = animationEnd - Date.now();
            	if (timeLeft <= 0) {
            		return clearInterval(interval);
            	}
            	const particleCount = 25 * (timeLeft / duration);
              shoot(particleCount);
            },250);
          }
          shoot();
        }
        function party(){
          const a=new AudioContext(),o=a.createOscillator(),g=a.createGain();
          o.type='square';
          o.frequency.setValueAtTime(500,a.currentTime);
          g.gain.setValueAtTime(1,a.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.3);
          o.connect(g).connect(a.destination);
          o.start();o.stop(a.currentTime+0.3);
        }
        function clap(){
          const a=new AudioContext(),b=a.createBuffer(1,a.sampleRate*0.3,a.sampleRate),
                d=b.getChannelData(0);
          for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
          const s=a.createBufferSource();s.buffer=b;
          const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=1000;
          const g=a.createGain();g.gain.setValueAtTime(1,a.currentTime);
          g.gain.exponentialRampToValueAtTime(0.01,a.currentTime+0.3);
          s.connect(f).connect(g).connect(a.destination);s.start();
        }
        function confettiTime(type = 0) {
          if(type == 0) party();
          else clap();
          let soundTimes = 0;
          const duration = 3 * 1 * 1000,
            animationEnd = Date.now() + duration,
            defaults = { startVelocity: 30, spread: 360, ticks: 20, zIndex: 0 };

          function randomInRange(min, max) {
          	return Math.random() * (max - min) + min;
          }
          const interval = setInterval(function () {
          	const timeLeft = animationEnd - Date.now();
          
          	if (timeLeft <= 0) {
          		return clearInterval(interval);
          	}
            if(type == 0) {
              soundTimes++;
              if(soundTimes < 10) clap();
            }
          
          	const particleCount = 25 * (timeLeft / duration);
          
          	// since particles fall down, start a bit higher than random
          	confetti(
          		Object.assign({}, defaults, {
          			particleCount,
          			origin: { x: randomInRange(0.1, 0.5), y: Math.random() - 0.2 }
          		})
          	);
          	confetti(
          		Object.assign({}, defaults, {
          			particleCount,
          			origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          		})
          	);
          }, 250);
        }
    }
async function generateSha256Hash(message) {
    const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}
function checkSite(window) {
  let search = window.location.search;
  if(typeof search !== "undefined" && search.length > 0) {
    let parts = [];
    try{
        parts = atob(search.slice(1)).split("&");
    }catch(e){}
    for(let part of parts) {
      let [k,v] = part.split("=");
      k = btoa(k);
      if(k == "ZGV2bW9kZQ==") {
        if(v == "true") {
            devMode = true;
        }
      }
    }
  }
  if(devMode) {
    enableDevMode();
  }
  setTimeout(()=>{
    let href = window.location.href;
    if(!href.includes(atob("YWxvbnNvYWxpYWdhLmdpdGh1Yi5pbw=="))) {
      try{document.title = `Page stolen from https://${atob("YWxvbnNvYWxpYWdhLmdpdGh1Yi5pbw==")}`;}catch(e){}
      window.location = `https://${atob("YWxvbnNvYWxpYWdhLmdpdGh1Yi5pbw==")}/font-creator/`}
  });
  fetch('https://api.github.com/repos/AlonsoAliaga/AlonsoAliagaAPI/contents/api/tools/tools-list.json?ref=main')
      .then(res => res.json())
      .then(content => {
        const decoded = atob(content.content);
        const parsed = JSON.parse(decoded);
        let toolsData = parsed;
        let toolsArray = []
        //console.log(`Loading ${Object.keys(toolsData).length} tools..`);
        for(let toolData of toolsData) {
          //console.log(toolData);
          let clazz = typeof toolData.clazz == "undefined" ? "" : ` class="${toolData.clazz}"`;
          let style = typeof toolData.style == "undefined" ? "" : ` style="${toolData.style}"`;
          toolsArray.push(`<span>💠</span> <span${clazz}${style}><a href="${toolData.link}">${toolData.name}</a></span><br>`);
        }
        document.getElementById("tools-for-you").innerHTML = toolsArray.join(`
`);
      });
}
function enableDevMode() {
    document.getElementById("generate-image-dev-div").style.display = "block";
    document.getElementById("rank-showcase").style.display = "block";
    document.getElementById("generate-image-normal-div").style.display = "none";
}
function toggleDarkmode() {
    if (document.getElementById('darkmode').checked == true) {
      document.body.classList.add('dark');
      //document.getElementById('result').classList.add("darktextboxes");
      for(let d of [...document.querySelectorAll(".lightbuttonboxes")]) {
          d.classList.remove("lightbuttonboxes");
          d.classList.add("darkbuttonboxes");
      }
      for(let d of [...document.querySelectorAll(".lighttextboxes")]) {
          d.classList.remove("lighttextboxes");
          d.classList.add("darktextboxes");
      }
      for(let d of [...document.querySelectorAll(".lighttext")]) {
          d.classList.remove("lighttext");
          d.classList.add("darktext");
      }
      for(let d of [...document.querySelectorAll(".light")]) {
          d.classList.remove("light");
          d.classList.add("dark");
      }
      let success = document.getElementById('success_message');
      if(success) {
        success.classList.remove("successlight");
        success.classList.add("successdark");
      }
    } else {
      document.body.classList.remove('dark');
      //document.getElementById('result').classList.remove("darktextboxes");
      //Buttons
      for(let d of [...document.querySelectorAll(".darkbuttonboxes")]) {
          d.classList.remove("darkbuttonboxes");
          d.classList.add("lightbuttonboxes");
      }
      for(let d of [...document.querySelectorAll(".darktextboxes")]) {
          d.classList.remove("darktextboxes");
          d.classList.add("lighttextboxes");
      }
      for(let d of [...document.querySelectorAll(".darktext")]) {
          d.classList.remove("darktext");
          d.classList.add("lighttext");
      }
      for(let d of [...document.querySelectorAll(".dark")]) {
          d.classList.remove("dark");
          d.classList.add("light");
      }
      let success = document.getElementById('success_message');
      if(success) {
        success.classList.remove("successdark");
        success.classList.add("successlight");
      }
    }
    //console.log("Dark mode is now: "+(document.getElementById('darkmode').checked))
}
function testFont(event) {
  let dev = event.altKey && event.ctrlKey;
  if(dev) {
    inputText.value = ALL_CHARS;
  }else inputText.value = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789";
  generateImage(devMode);
}
