import { Image, Text, View } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } from 'react-native-google-mobile-ads';

type Props = {
  nativeAd: NativeAd | null;
  language: 'en' | 'zh';
};

export function NativePracticeAdCard({ nativeAd, language }: Props) {
  if (!nativeAd) {
    return null;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.badge}>{language === 'zh' ? '广告' : 'Sponsored'}</Text>

        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={styles.headline}>{nativeAd.headline}</Text>
        </NativeAsset>

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.body}>{nativeAd.body}</Text>
          </NativeAsset>
        ) : null}

        <NativeMediaView style={styles.media} resizeMode="cover" />

        <View style={styles.footerRow}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : (
            <View style={styles.iconPlaceholder} />
          )}

          {nativeAd.callToAction ? (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
            </NativeAsset>
          ) : null}
        </View>
      </View>
    </NativeAdView>
  );
}

const styles = {
  card: {
    backgroundColor: '#f8f4ec',
    borderWidth: 1,
    borderColor: '#dccdb7',
    borderRadius: 24,
    overflow: 'hidden' as const,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#165a72',
    textTransform: 'uppercase' as const,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800' as const,
    color: '#172126',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5f5648',
  },
  footerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 16,
  },
  media: {
    width: '100%' as const,
    height: 152,
    borderRadius: 18,
    overflow: 'hidden' as const,
    backgroundColor: '#e6ddd0',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800' as const,
    backgroundColor: '#ca4d2f',
    overflow: 'hidden' as const,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
};
