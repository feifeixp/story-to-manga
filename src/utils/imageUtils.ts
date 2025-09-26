// Image utility functions

/**
 * Helper function to convert URLs to proxy URLs (支持VolcEngine和R2)
 */
export const getProxyImageUrl = (originalUrl: string): string => {
	if (!originalUrl || originalUrl.includes('placeholder') || originalUrl.startsWith('data:')) {
		return originalUrl;
	}

	// Check if it's a URL that needs proxying
	const proxyDomains = [
		'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com',
		'tos-cn-beijing.volces.com',
		'pub-23959c61a0814f2a91a19cc37b24a893.r2.dev', // R2开发域名
		'manga.neodomain.ai' // R2生产域名
	];

	try {
		const urlObj = new URL(originalUrl);
		const needsProxy = proxyDomains.some(domain =>
			urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
		);

		if (needsProxy) {
			// Convert to proxy URL
			return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
		}
	} catch (error) {
		console.warn('Invalid URL:', originalUrl);
	}

	return originalUrl;
};

/**
 * Preload images for better performance
 */
export const preloadImages = async (imageUrls: string[]): Promise<void> => {
	return new Promise((resolve) => {
		let loadedCount = 0;
		const totalImages = imageUrls.length;

		if (totalImages === 0) {
			resolve();
			return;
		}

		const handleImageLoad = () => {
			loadedCount++;
			if (loadedCount === totalImages) {
				resolve();
			}
		};

		const handleImageError = (url: string) => {
			console.warn(`Failed to preload image: ${url}`);
			handleImageLoad(); // Continue even if some images fail
		};

		imageUrls.forEach((url) => {
			if (!url || url.includes('placeholder') || url.startsWith('data:image/svg')) {
				// Skip placeholder images
				handleImageLoad();
				return;
			}

			// Use proxy URL for VolcEngine images
			const proxyUrl = getProxyImageUrl(url);
			console.log(`Preloading image: ${url} -> ${proxyUrl}`);

			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = handleImageLoad;
			img.onerror = () => handleImageError(proxyUrl);
			img.src = proxyUrl;
		});

		// Set a timeout to prevent hanging
		setTimeout(() => {
			if (loadedCount < totalImages) {
				console.warn(`Timeout: Only ${loadedCount}/${totalImages} images loaded`);
				resolve();
			}
		}, 10000); // 10 second timeout
	});
};

/**
 * Download a single image
 */
export const downloadImage = (imageUrl: string, filename: string) => {
	const link = document.createElement("a");
	link.href = imageUrl;
	link.download = filename;
	link.click();
};
