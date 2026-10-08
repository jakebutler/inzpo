import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { ActionButton } from '@/components/ActionButton';
import { Baku } from '@/components/Baku';
import { BriefBlock } from '@/components/BriefBlock';
import { EditSheet, type EditSheetHandle } from '@/components/EditSheet';
import { RoleBands } from '@/components/RoleBands';
import { SaveSheet } from '@/components/SaveSheet';
import { useKit } from '@/lib/use-kit';
import { useResultSequence } from '@/lib/useResultSequence';
import { useBakuPupils } from '@/lib/useBakuPupils';
import { useBakuHop } from '@/lib/useBakuHop';
import { INK } from '@/theme/tokens';
import { ui } from '@/theme/styles';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { kit, loading, error, briefFailed, retry } = useKit(id);
  const [sheet, setSheet] = useState<{ kitId: string; type: 'save' | 'edit' } | null>(null);
  const editSheet = useRef<EditSheetHandle>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photoFailed = !!kit?.photo && kit.photo.url === failedPhotoUrl;
  const { height } = useWindowDimensions();
  const ready = !!kit && (briefFailed || kit.brief.status !== 'pending');
  const failedBrief = briefFailed || kit?.brief.status === 'failed' || (kit?.brief.status === 'ready' && !kit.brief.text);
  const pupils = useBakuPupils(96);
  const sequence = useResultSequence({ kitId: id, ready, roles: kit?.roles, jiggle: pupils.jiggle });
  const hop = useBakuHop({ kitId: id, base: sequence.values, jiggle: pupils.jiggle });

  return (
    <SafeAreaView style={ui.screen} edges={['bottom', 'left', 'right']} onTouchStart={sequence.skipToEnd}>
      <ScrollView
        testID="result-content"
        contentContainerStyle={[ui.content, !kit && { flexGrow: 1 }]}
        onScrollBeginDrag={sequence.skipToEnd}
        onMomentumScrollBegin={sequence.skipToEnd}
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.x !== 0 || nativeEvent.contentOffset.y !== 0) sequence.skipToEnd();
        }}
        scrollEventThrottle={16}
      >
        {loading ? (
          <View style={ui.center}>
            <Baku pose="chewing" motionStyle={sequence.bakuStyle} />
            <Text style={ui.message}>Baku is chewing on it…</Text>
          </View>
        ) : error ? (
          <View style={ui.center}>
            <Baku pose={error === 'notFound' ? 'notFound' : 'errorPhoto'} />
            <Text style={ui.message}>{error === 'notFound' ? 'This kit couldn’t be found.' : 'Couldn’t load this kit. Please try again.'}</Text>
            <ActionButton label="Try again" onPress={retry} />
          </View>
        ) : kit ? (
          <>
            <Text style={ui.heading}>{kit.title}</Text>
            {/* TODO(motion): Photo collapses to 40% of its slot at largest Dynamic Type. */}
            {/* TODO(motion): Shared-element hand-off from the frozen camera frame. */}
            {kit.photo && !photoFailed ? (
              <Image
                key={kit.photo.url}
                source={{ uri: kit.photo.url }}
                contentFit="cover"
                style={[styles.photo, { height: height * 0.4 }]}
                accessibilityLabel="House photo"
                onError={() => setFailedPhotoUrl(kit.photo!.url)}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder, { height: height * 0.4 }]}>
                <Baku pose={photoFailed ? 'errorPhoto' : 'empty'} roles={kit.roles} stripeProgress={sequence.stripeProgress} wipeMode={sequence.wipeMode} />
                <Text style={ui.message}>{photoFailed ? 'Couldn’t load the photo.' : 'No photo in this kit.'}</Text>
                {photoFailed && <ActionButton label="Reload photo" onPress={() => { setFailedPhotoUrl(null); retry(); }} />}
              </View>
            )}
            {/* No pin coordinates exist in MobileKit yet. sequence.markerStyle
                is ready for them; on pin drag call editSheet.current?.snapToPeek().
                TODO(motion): Photo pins, hairlines and loupe/picker integration. */}
            <View style={styles.baku}>
              <View testID="result-baku" style={styles.bakuStage}>
                <Baku pose={hop.pose ?? (!ready ? 'chewing' : failedBrief ? 'errorBrief' : 'idle')} roles={kit.roles} stripeProgress={sequence.stripeProgress} wipeMode={sequence.wipeMode} pupilOffset={pupils.offset} motionStyle={hop.bakuStyle} />
                {/* Sprites include opaque paper; draw the ground ellipse over
                    that paper so the contact shadow stays visible. */}
                <Animated.View testID="baku-contact-shadow" pointerEvents="none" accessible={false} style={[styles.contactShadow, hop.shadowStyle]} />
              </View>
              {!ready && <BriefBlock brief={kit.brief} showBaku={false} />}
            </View>
            {ready && (
              <>
                <RoleBands roles={kit.roles} motion={sequence.bands} />
                <BriefBlock brief={kit.brief} failed={briefFailed} showBaku={false} motionStyle={sequence.briefStyle} />
              </>
            )}
            {(briefFailed || kit.brief.status === 'failed') && <ActionButton label="Check brief again" onPress={retry} />}
          </>
        ) : null}
        <ActionButton label="Save" primary disabled={!sequence.interactive} onPress={() => setSheet({ kitId: id, type: 'save' })} />
        <ActionButton label="Edit" disabled={!sequence.interactive} onPress={() => setSheet({ kitId: id, type: 'edit' })} />
        {/* TODO(motion): Kit overflow/export sheet with dynamic sizing and 52pt action rows. */}
      </ScrollView>
      {kit && (
        <>
          <SaveSheet visible={sheet?.kitId === id && sheet.type === 'save'} kitId={kit.id} onClose={() => setSheet(null)} onSaved={hop.onSaved} onSaveError={hop.onSaveError} />
          <EditSheet ref={editSheet} visible={sheet?.kitId === id && sheet.type === 'edit'} roles={kit.roles} onClose={() => setSheet(null)} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  baku: { alignItems: 'center' },
  bakuStage: { width: 96, height: 96 },
  contactShadow: {
    position: 'absolute', left: 26, bottom: 3, width: 50, height: 6,
    borderRadius: 25, backgroundColor: INK, opacity: 0.055,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 3, color: 'rgba(42, 37, 32, 0.10)' }],
  },
});
