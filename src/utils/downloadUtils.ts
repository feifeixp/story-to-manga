import JSZip from "jszip";

/**
 * Download multiple images as a ZIP file
 */
export const downloadImagesAsZip = async (
	images: { url: string; filename: string }[],
	zipFilename: string,
) => {
	const zip = new JSZip();

	// Fetch all images and add to zip
	const promises = images.map(async ({ url, filename }) => {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			zip.file(filename, blob);
		} catch (error) {
			console.error(`Failed to fetch image: ${filename}`, error);
		}
	});

	await Promise.all(promises);

	// Generate zip file and download
	const zipBlob = await zip.generateAsync({ type: "blob" });
	const zipUrl = URL.createObjectURL(zipBlob);

	const link = document.createElement("a");
	link.href = zipUrl;
	link.download = zipFilename;
	link.click();

	// Clean up
	setTimeout(() => URL.revokeObjectURL(zipUrl), 100);
};

/**
 * Download story analysis as JSON
 */
export const downloadStoryAnalysis = (storyAnalysis: any, style: string) => {
	if (!storyAnalysis) return;

	const exportData = {
		metadata: {
			title: "Story Analysis Export",
			exportDate: new Date().toISOString(),
			style: style,
			generatedBy: "Story to Manga Machine",
		},
		storyAnalysis: {
			title: storyAnalysis.title,
			characters: storyAnalysis.characters,
			setting: storyAnalysis.setting,
		},
	};

	const blob = new Blob([JSON.stringify(exportData, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `story-analysis-${Date.now()}.json`;
	link.click();
	URL.revokeObjectURL(url);
};

/**
 * Download comic layout as JSON
 */
export const downloadComicLayout = (storyBreakdown: any, storyAnalysis: any, style: string) => {
	if (!storyBreakdown || !storyAnalysis) return;

	const exportData = {
		metadata: {
			title: "Comic Layout Export",
			exportDate: new Date().toISOString(),
			style: style,
			generatedBy: "Story to Manga Machine",
		},
		storyTitle: storyAnalysis.title,
		panelCount: storyBreakdown.panels.length,
		panels: storyBreakdown.panels.map((panel: any) => ({
			panelNumber: panel.panelNumber,
			sceneDescription: panel.sceneDescription,
			dialogue: panel.dialogue,
			characters: panel.characters,
			cameraAngle: panel.cameraAngle,
			visualMood: panel.visualMood,
		})),
	};

	const blob = new Blob([JSON.stringify(exportData, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `comic-layout-${Date.now()}.json`;
	link.click();
	URL.revokeObjectURL(url);
};
