declare module "ali-oss/dist/aliyun-oss-sdk.min.js" {
	export default class OSS {
		constructor(options: {
			region: string;
			bucket: string;
			accessKeyId: string;
			accessKeySecret: string;
			stsToken: string;
			secure: boolean;
		});
		put(name: string, data: Blob): Promise<{ url: string }>;
	}
}

declare module "*.svg" {
	const src: string;
	export default src;
}
