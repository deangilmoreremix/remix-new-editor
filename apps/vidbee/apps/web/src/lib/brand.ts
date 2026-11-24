export type Brand = "upstream" | "remix" | "higgs";

const BRANDS: readonly Brand[] = ["upstream", "remix", "higgs"];
const STORAGE_KEY = "vidbee-brand";

const isBrand = (value: string | null): value is Brand =>
	value !== null && (BRANDS as readonly string[]).includes(value);

/** `?brand=` wins and is remembered; otherwise the last choice; otherwise upstream's own look. */
export const resolveBrand = (): Brand => {
	if (typeof window === "undefined") {
		return "upstream";
	}
	let stored: string | null = null;
	try {
		stored = window.localStorage.getItem(STORAGE_KEY);
	} catch {
		// Storage can be blocked (private windows, embedded frames); the query parameter still works.
	}
	const fromUrl = new URLSearchParams(window.location.search).get("brand");
	if (isBrand(fromUrl)) {
		try {
			window.localStorage.setItem(STORAGE_KEY, fromUrl);
		} catch {
			// not remembered
		}
		return fromUrl;
	}
	return isBrand(stored) ? stored : "upstream";
};

export const applyBrandToDocument = (): void => {
	if (typeof window === "undefined") {
		return;
	}
	const brand = resolveBrand();
	const root = window.document.documentElement;
	if (brand === "upstream") {
		delete root.dataset.brand;
	} else {
		root.dataset.brand = brand;
	}
};

/** Runs before the first paint so the page does not flash the wrong colours. */
export const BRAND_BOOT_SCRIPT = `(function(){try{var k="${STORAGE_KEY}",p=new URLSearchParams(location.search).get("brand"),b=["remix","higgs","upstream"],v=b.indexOf(p)>-1?p:null;if(v){try{localStorage.setItem(k,v)}catch(e){}}else{try{v=localStorage.getItem(k)}catch(e){}}if(b.indexOf(v)>-1&&v!=="upstream"){document.documentElement.setAttribute("data-brand",v)}}catch(e){}})();`;
