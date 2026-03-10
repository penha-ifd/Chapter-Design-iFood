import type {
  LibraryIndex,
  SerializedLibraryIndex,
  LibraryComponentInfo,
  ColorToken,
  TextStyleToken,
} from '../shared/types';
import { CACHE_KEY_LIBRARY } from '../shared/constants';
import { rgbToHex } from './color-utils';

async function getLocalPaintStyles(): Promise<PaintStyle[]> {
  try {
    if (typeof (figma as any).getLocalPaintStylesAsync === 'function') {
      return await (figma as any).getLocalPaintStylesAsync();
    }
    return figma.getLocalPaintStyles();
  } catch (_) {
    return [];
  }
}

async function getLocalTextStyles(): Promise<TextStyle[]> {
  try {
    if (typeof (figma as any).getLocalTextStylesAsync === 'function') {
      return await (figma as any).getLocalTextStylesAsync();
    }
    return figma.getLocalTextStyles();
  } catch (_) {
    return [];
  }
}

async function getStyleById(id: string): Promise<BaseStyle | null> {
  try {
    if (typeof (figma as any).getStyleByIdAsync === 'function') {
      return await (figma as any).getStyleByIdAsync(id);
    }
    return figma.getStyleById(id);
  } catch (_) {
    return null;
  }
}

export class LibraryParser {
  private index: LibraryIndex | null = null;

  async loadIndex(forceRebuild = false): Promise<LibraryIndex> {
    if (!forceRebuild) {
      const cached = await this.loadFromCache();
      if (cached) {
        this.index = cached;
        return cached;
      }
    }

    this.index = await this.buildIndex();
    await this.saveToCache(this.index);
    return this.index;
  }

  getIndex(): LibraryIndex | null {
    return this.index;
  }

  setExternalIndex(serialized: SerializedLibraryIndex): LibraryIndex {
    const componentNames = new Set(serialized.componentNames || []);
    serialized.components.forEach(function(c) {
      componentNames.add(c.name);
      if (c.componentSetName) componentNames.add(c.componentSetName);
    });

    this.index = {
      components: serialized.components,
      componentNames: componentNames,
      colorTokens: serialized.colorTokens,
      textStyles: serialized.textStyles,
      spacingScale: serialized.spacingScale,
      lastBuilt: serialized.lastBuilt || Date.now(),
      fromApi: true,
    };

    this.saveToCache(this.index);
    return this.index;
  }

  private async buildIndex(): Promise<LibraryIndex> {
    const components = await this.collectComponents();
    const colorTokens = await this.collectColorTokens();
    const textStyles = await this.collectTextStyles();

    const componentNames = new Set(components.map((c) => c.name));
    components.forEach((c) => {
      if (c.componentSetName) componentNames.add(c.componentSetName);
    });

    return {
      components,
      componentNames,
      colorTokens,
      textStyles,
      spacingScale: SPACING_SCALE.slice(),
      lastBuilt: Date.now(),
      fromApi: false,
    };
  }

  private async collectComponents(): Promise<LibraryComponentInfo[]> {
    const components: LibraryComponentInfo[] = [];
    const seenKeys = new Set<string>();

    const processNode = (node: SceneNode) => {
      if (node.type === 'INSTANCE' && node.mainComponent) {
        const mc = node.mainComponent;
        if (!seenKeys.has(mc.key)) {
          seenKeys.add(mc.key);

          let componentSetName: string | undefined;
          if (mc.parent && mc.parent.type === 'COMPONENT_SET') {
            componentSetName = mc.parent.name;
          }

          components.push({
            key: mc.key,
            name: mc.name,
            description: mc.description || '',
            remote: mc.remote,
            componentSetName,
          });
        }
      }

      if ('children' in node) {
        for (const child of (node as ChildrenMixin).children) {
          processNode(child as SceneNode);
        }
      }
    };

    for (const child of figma.currentPage.children) {
      processNode(child);
    }

    return components;
  }

  private async collectColorTokens(): Promise<ColorToken[]> {
    const tokens: ColorToken[] = [];
    const seenColors = new Set<string>();

    const paintStyles = await getLocalPaintStyles();

    for (const style of paintStyles) {
      for (const paint of style.paints) {
        if (paint.type === 'SOLID' && paint.visible !== false) {
          const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
          if (!seenColors.has(hex)) {
            seenColors.add(hex);
            tokens.push({
              name: style.name,
              hex,
              r: paint.color.r,
              g: paint.color.g,
              b: paint.color.b,
              styleId: style.id,
            });
          }
        }
      }
    }

    await this.collectRemoteColorTokens(tokens, seenColors);

    return tokens;
  }

  private async collectRemoteColorTokens(
    tokens: ColorToken[],
    seenColors: Set<string>
  ): Promise<void> {
    const styleIds = new Set<string>();

    const collectStyleIds = (node: SceneNode) => {
      if ('fillStyleId' in node) {
        const fid = (node as any).fillStyleId;
        if (typeof fid === 'string' && fid !== '') {
          styleIds.add(fid);
        }
      }
      if ('children' in node) {
        for (const child of (node as ChildrenMixin).children) {
          collectStyleIds(child as SceneNode);
        }
      }
    };

    for (const child of figma.currentPage.children) {
      collectStyleIds(child);
    }

    for (const sid of styleIds) {
      try {
        const style = await getStyleById(sid);
        if (style && style.type === 'PAINT') {
          const paintStyle = style as PaintStyle;
          if (paintStyle.remote) {
            for (const paint of paintStyle.paints) {
              if (paint.type === 'SOLID' && paint.visible !== false) {
                const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
                if (!seenColors.has(hex)) {
                  seenColors.add(hex);
                  tokens.push({
                    name: paintStyle.name,
                    hex,
                    r: paint.color.r,
                    g: paint.color.g,
                    b: paint.color.b,
                    styleId: paintStyle.id,
                  });
                }
              }
            }
          }
        }
      } catch (_) {
        // Skip inaccessible styles
      }
    }
  }

  private async collectTextStyles(): Promise<TextStyleToken[]> {
    const styles: TextStyleToken[] = [];
    const seenIds = new Set<string>();

    const localStyles = await getLocalTextStyles();
    for (const style of localStyles) {
      if (!seenIds.has(style.id)) {
        seenIds.add(style.id);
        styles.push(this.textStyleToToken(style));
      }
    }

    const textStyleIds = new Set<string>();

    const collectStyleIds = (node: SceneNode) => {
      if (node.type === 'TEXT') {
        const tsid = (node as any).textStyleId;
        if (typeof tsid === 'string' && tsid !== '') {
          textStyleIds.add(tsid);
        }
      }
      if ('children' in node) {
        for (const child of (node as ChildrenMixin).children) {
          collectStyleIds(child as SceneNode);
        }
      }
    };

    for (const child of figma.currentPage.children) {
      collectStyleIds(child);
    }

    for (const tsid of textStyleIds) {
      if (seenIds.has(tsid)) continue;
      try {
        const style = await getStyleById(tsid);
        if (style && style.type === 'TEXT' && !seenIds.has(style.id)) {
          seenIds.add(style.id);
          styles.push(this.textStyleToToken(style as TextStyle));
        }
      } catch (_) {
        // Skip inaccessible styles
      }
    }

    return styles;
  }

  private textStyleToToken(style: TextStyle): TextStyleToken {
    let lineHeight: number | null = null;
    if (style.lineHeight && typeof style.lineHeight === 'object' && 'value' in style.lineHeight) {
      lineHeight = (style.lineHeight as { value: number }).value;
    }

    return {
      name: style.name,
      fontFamily: style.fontName.family,
      fontWeight: style.fontName.style,
      fontSize: style.fontSize,
      lineHeight,
      letterSpacing: typeof style.letterSpacing === 'object' && 'value' in style.letterSpacing
        ? style.letterSpacing.value
        : 0,
      styleId: style.id,
    };
  }

  private async loadFromCache(): Promise<LibraryIndex | null> {
    try {
      const raw = await figma.clientStorage.getAsync(CACHE_KEY_LIBRARY) as string | undefined;
      if (!raw) return null;

      const serialized: SerializedLibraryIndex = JSON.parse(raw);

      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - serialized.lastBuilt > maxAge) return null;

      return {
        components: serialized.components,
        componentNames: new Set(serialized.componentNames),
        colorTokens: serialized.colorTokens,
        textStyles: serialized.textStyles,
        spacingScale: serialized.spacingScale,
        lastBuilt: serialized.lastBuilt,
        fromApi: serialized.fromApi === true,
      };
    } catch (_) {
      return null;
    }
  }

  private async saveToCache(index: LibraryIndex): Promise<void> {
    try {
      const serialized: SerializedLibraryIndex = {
        components: index.components,
        componentNames: Array.from(index.componentNames),
        colorTokens: index.colorTokens,
        textStyles: index.textStyles,
        spacingScale: index.spacingScale,
        lastBuilt: index.lastBuilt,
        fromApi: index.fromApi,
      };
      await figma.clientStorage.setAsync(CACHE_KEY_LIBRARY, JSON.stringify(serialized));
    } catch (_) {
      // Cache save failure is non-critical
    }
  }
}
