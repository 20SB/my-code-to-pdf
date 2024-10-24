const fs = require("fs-extra");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib"); // Ensure you're importing rgb directly
const fontkit = require("fontkit");

// Directories to ignore
const ignoreDirectories = [
  "node_modules",
  ".github",
  "package.json",
  "package-lock.json",
  "drizzle",
  "drizzle.config.ts",
  "Readme.md",
  "tsconfig.json",
  "yarn.lock",
];

// Output directory
const outputDirectory = "output/astrix-event-api-alpha";

// Function to create a PDF from a code file and store it in the output directory
const createPdfFromFile = async (filePath, relativePath) => {
  const outputFilePath = path.join(outputDirectory, relativePath);
  fs.ensureDirSync(path.dirname(outputFilePath)); // Ensure the output folder structure exists

  const doc = await PDFDocument.create(); // Create a new PDF document

  // Register fontkit with the PDF document
  doc.registerFontkit(fontkit);

  // Load the Courier Prime Bold Italic font from the local .ttf file
  const fontBytes = fs.readFileSync(
    path.join(__dirname, "CourierPrime-Regular.ttf")
  );
  const font = await doc.embedFont(fontBytes); // Embed the custom font

  // Prepare the content from the file
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Page setup parameters
  const pageWidth = 600;
  const pageHeight = 800;
  const margin = 10;
  const fontSize = 8; // Reduced font size
  const lineHeight = 10; // Distance between each line, adjusted for smaller font
  const maxLineWidth = pageWidth - margin * 2; // Maximum line width for text wrapping

  let y = pageHeight - margin; // Initial position for text

  // Function to wrap text if line is too long
  const wrapText = (text, font, fontSize, maxWidth) => {
    const words = text.split(" ");
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine); // Add the last line
    return lines;
  };

  // Add pages as needed to fit all the lines
  let page = doc.addPage([pageWidth, pageHeight]); // Add first page
  lines.forEach((line, index) => {
    // Wrap long lines if necessary
    const wrappedLines = wrapText(line, font, fontSize, maxLineWidth);

    wrappedLines.forEach((wrappedLine) => {
      if (y < margin + lineHeight) {
        // If there is no more space on the current page, add a new page
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin; // Reset y position for the new page
      }

      // Draw the wrapped text line on the page
      page.drawText(wrappedLine, {
        x: margin,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0), // Use the rgb function directly
      });

      y -= lineHeight; // Move down for the next line
    });
  });

  const pdfBytes = await doc.save(); // Save the PDF document
  fs.writeFileSync(`${outputFilePath}.pdf`, pdfBytes); // Write to the output file
  console.log(`Created PDF: ${outputFilePath}.pdf`);

  return `${outputFilePath}.pdf`; // Return the PDF file path
};

// Function to traverse project directory and collect PDFs
const traverseDirectory = async (
  directory,
  relativeDirectory = "",
  pdfFiles = []
) => {
  const files = fs.readdirSync(directory, {
    withFileTypes: true,
  });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    const relativePath = path.join(relativeDirectory, file.name); // Preserve folder structure

    if (file.isDirectory()) {
      if (!ignoreDirectories.includes(file.name)) {
        await traverseDirectory(fullPath, relativePath, pdfFiles); // Recursively traverse directories
      }
    } else if (
      [".js", ".ts", ".sql", ".py", ".java", ".html", ".css", ".txt"].includes(
        path.extname(file.name)
      )
    ) {
      try {
        const pdfFile = await createPdfFromFile(fullPath, relativePath); // Create PDF and store it in output folder
        pdfFiles.push(pdfFile); // Add the PDF file path to the array
      } catch (err) {
        console.error(
          `Failed to create PDF for file: ${fullPath} - ${err.message}`
        );
      }
    }
  }
  return pdfFiles;
};

// Function to merge PDFs and handle errors
const mergePdfs = async (pdfPaths, outputFile) => {
  const mergedPdf = await PDFDocument.create(); // Create a new PDF document

  // Register fontkit with the PDF document
  mergedPdf.registerFontkit(fontkit);

  // Load the Courier Prime Bold Italic font from the local .ttf file
  const fontBytes = fs.readFileSync(
    path.join(__dirname, "CourierPrime-BoldItalic.ttf")
  );
  const font = await mergedPdf.embedFont(fontBytes);

  for (const pdfPath of pdfPaths) {
    try {
      const pdfData = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfData);

      // Add a new page with the file path as a header
      const filePathComment = `// ${pdfPath.replace(
        `${outputDirectory}/`,
        ""
      )}`;
      const page = mergedPdf.addPage([600, 50]);
      page.drawText(filePathComment, {
        x: 20,
        y: 30,
        size: 10,
        font,
        color: rgb(0, 0, 0), // Use the rgb function directly
      });

      const copiedPages = await mergedPdf.copyPages(
        pdfDoc,
        pdfDoc.getPageIndices()
      );
      copiedPages.forEach((copiedPage) => mergedPdf.addPage(copiedPage));
    } catch (err) {
      console.error(`Skipping invalid PDF: ${pdfPath} - ${err.message}`);
    }
  }

  const mergedPdfData = await mergedPdf.save();
  fs.writeFileSync(outputFile, mergedPdfData);
  console.log(`Merged PDF created at: ${outputFile}`);
};

// Main execution function
(async () => {
  const projectDirectory = "../astrix/astrix-event-api-alpha"; // Change to your project directory
  const pdfFiles = await traverseDirectory(projectDirectory); // Get all the generated PDFs

  const mergedPdfPath = path.join(
    outputDirectory,
    `${outputDirectory}-codes.pdf"`
  ); // Path for the merged PDF
  await mergePdfs(pdfFiles, mergedPdfPath); // Merge all PDFs into one
})();
