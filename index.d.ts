import type { NextFunction } from 'express';

export interface responsiveImages {
	staticDir?          : string,
	watchedDirectories? : string[],
	fileTypes?          : string[],
	fileTypeConversion? : string,
	cacheSuffix?        : string,
	cookieName?         : string,
	scaleBy?            : string,
	breakpoints?        : number[],
	directScaling?      : boolean,
	directScalingParam? : string,
	directScaleSizes?   : number[],
	debug?              : boolean,
}

declare function expressResponsiveImages(options?: responsiveImages): NextFunction;

export default expressResponsiveImages;
