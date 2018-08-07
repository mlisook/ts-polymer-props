
export interface IelementTypes {
    [index: string]: string;
    a: string;
    div: string;
    button: string;
    form: string;
    head: string;
    iframe: string;
    img: string;
    input: string;
    li: string;
    ol: string;
    p: string;
    picture: string;
    script: string;
    select: string;
    textarea: string;
    title: string;
    ul: string;
}

export interface InamedElements {
    id: string;
    tag: string;
    className: string;
}

export let elementTypes: IelementTypes = {
    a: "HTMLAnchorElement",
    div: "HTMLDivElement",
    button: "HTMLButtonElement",
    canvas: "HTMLCanvasElement",
    form: "HTMLFormElement",
    head: "HTMLHeadElement",
    iframe: "HTMLIFrameElement",
    img: "HTMLImageElement",
    input: "HTMLInputElement",
    li: "HTMLLIElement",
    ol: "HTMLOListElement",
    p: "HTMLParagraphElement",
    picture: "HTMLPictureElement",
    script: "HTMLScriptElement",
    select: "HTMLSelectElement",
    textarea: "HTMLTextAreaElement",
    title: "HTMLTitleElement",
    ul: "HTMLUListElement"
};

export function toKebab(str: string): string {
    return str.replace(/(?!^)([A-Z\u00C0-\u00D6])/g, function (match) {
        return '-' + match.toLowerCase();
    });
}

export function parseTemplateForIds(strTemplate: string): InamedElements[] {
    let result: InamedElements[] = [];
    const rxIdElem = /<([\w\-]+) .*id="(\w+)"/g;
    let m: RegExpExecArray | null;

    while ((m = rxIdElem.exec(strTemplate)) !== null) {
        if (m.index === rxIdElem.lastIndex) {
            rxIdElem.lastIndex++;
        }
        let r: InamedElements = {
            id: m[2],
            tag: m[1],
            className: 'HTMLElement'
        };
        if (elementTypes[r.tag]) {
            r.className = elementTypes[r.tag];
        }
        result.push(r);
    }
    return result;
}
