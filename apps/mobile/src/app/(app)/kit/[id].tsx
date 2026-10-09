import { emptyRoles, type ColorRole } from '@inzpo/shared';
import { Canvas, LinearGradient, Rect } from '@shopify/react-native-skia';
import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { Baku } from '@/components/Baku';
import { BackButton } from '@/components/BackButton';
import { BriefBlock } from '@/components/BriefBlock';
import { ChipPile } from '@/components/ChipPile';
import { ChewingCaption } from '@/components/ChewingCaption';
import { ChipDetail } from '@/components/ChipDetail';
import { CornerBaku } from '@/components/CornerBaku';
import { EditSheet, type EditSheetHandle } from '@/components/EditSheet';
import { FilmPrint } from '@/components/FilmPrint';
import { PaperTexture } from '@/components/PaperTexture';
import { PrimaryArrow } from '@/components/PrimaryArrow';
import { SavedKit } from '@/components/SavedKit';
import { toggleChip } from '@/lib/chip-flip';
import type { SavedCollection } from '@/components/KeepScreen';
import { useInzpoClient } from '@/lib/api';
import { resultLayout } from '@/lib/result-layout';
import { photoPins, primaryHue } from '@/lib/result-pins';
import { useKit } from '@/lib/use-kit';
import { capturePhoto } from '@/lib/photo-handoff';
import { useResultSequence } from '@/lib/useResultSequence';
import { useBakuPupils } from '@/lib/useBakuPupils';
import { useBakuHop } from '@/lib/useBakuHop';
import { MunchPlayer } from '@/munch/MunchPlayer';
import { PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ id: string; saved?: string; c?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { kit, loading, error, briefFailed, retry, replaceKit } = useKit(id);
  const client = useInzpoClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const [actionHeight, setActionHeight] = useState(48);
  const [headerHeight, setHeaderHeight] = useState<number>();
  const layout = resultLayout({ width: width - insets.left - insets.right, height,
    topInset: insets.top, bottomInset: insets.bottom, fontScale, actionHeight, measuredHeaderHeight: headerHeight });
  const [savedCollection, setSavedCollection] = useState<(SavedCollection & { kitId: string }) | null>(null);
  const savedId = savedCollection?.kitId === id ? savedCollection.collectionId
    : kit?.collectionIds[0] ?? (params.saved === '1' ? params.c ?? '' : null);
  const isSaved = savedId !== null;
  const footerBottom = isSaved ? Math.max(26, insets.bottom + 16) : layout.footerBottom;
  const collectionName = savedCollection?.kitId === id ? savedCollection.collectionName : 'your collection';
  useEffect(() => {
    if (savedId === null || savedCollection?.kitId === id) return;
    let active = true;
    client.listCollections().then((collections) => {
      if (active) setSavedCollection({ kitId: id, collectionId: savedId,
        collectionName: collections.find((collection) => collection.id === savedId)?.name ?? 'your collection' });
    }).catch(() => {});
    return () => { active = false; };
  }, [client, id, savedId, savedCollection?.kitId]);
  const [sheet, setSheet] = useState<{ kitId: string; type: 'edit'; role?: ColorRole } | null>(null);
  const editing = sheet?.kitId === id && sheet.type === 'edit';
  const editSheet = useRef<EditSheetHandle>(null);
  const [selectedRole, setSelectedRole] = useState<ColorRole | null>(null);
  const [detail, setDetail] = useState<{ kitId: string; role: ColorRole; scrollY: number } | null>(null);
  const scrollY = useRef(0);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photoFailed = !!kit?.photo && kit.photo.url === failedPhotoUrl;
  const localPhoto = capturePhoto(id);
  const [displayedPhoto, setDisplayedPhoto] = useState<{ id: string; url: string } | null>(null);
  const renderedPhoto = loading ? localPhoto : kit?.photo;
  // A painted local preview cannot authorize playback for a new remote source.
  const photoVisible = !!renderedPhoto && !photoFailed && displayedPhoto?.id === id &&
    displayedPhoto.url === renderedPhoto.url;
  const ready = !!kit && (briefFailed || kit.brief.status !== 'pending');
  const failedBrief = briefFailed || kit?.brief.status === 'failed' || (kit?.brief.status === 'ready' && !kit.brief.text);
  const pupils = useBakuPupils(96);
  const sequence = useResultSequence({ kitId: id, ready, roles: kit?.roles, jiggle: pupils.jiggle });
  const hop = useBakuHop({ kitId: id, base: sequence.values, jiggle: pupils.jiggle });
  const celebratedKit = useRef<string | null>(null);
  const onSaved = hop.onSaved;
  useEffect(() => {
    if (params.saved !== '1' || !ready || celebratedKit.current === id) return;
    celebratedKit.current = id;
    onSaved();
  }, [id, params.saved, ready, onSaved]);
  const primaryPin = kit && kit.photo && !photoFailed ? photoPins(kit, layout.printWidth - 26, layout.photoHeight)
    .find((pin) => pin.role === 'primary') : undefined;
  const heroWidth = layout.contentWidth + 40;
  const munchWidth = Math.min(280, layout.contentWidth * 0.8);
  const printLeft = (heroWidth - layout.printWidth) / 2;
  const openRole = (role: ColorRole) => {
    if (sequence.interactive) setSheet({ kitId: id, type: 'edit', role });
  };

  return (
    <SafeAreaView style={ui.screen} edges={['left', 'right']} onTouchStart={sequence.skipToEnd}>
      <Stack.Screen options={{ headerShown: false, title: isSaved && kit ? kit.title : 'Your colors' }} />
      <PaperTexture />
      <ScrollView testID="result-content" contentContainerStyle={{ paddingTop: Math.max(isSaved ? 40 : 20, insets.top),
        paddingBottom: isSaved ? footerBottom : actionHeight + footerBottom + 32, minHeight: isSaved ? height : undefined }}
        onScrollBeginDrag={sequence.skipToEnd} onMomentumScrollBegin={sequence.skipToEnd}
        onScroll={({ nativeEvent }) => {
          scrollY.current = nativeEvent.contentOffset.y;
          if (nativeEvent.contentOffset.x !== 0 || nativeEvent.contentOffset.y !== 0) sequence.skipToEnd();
        }} scrollEventThrottle={16}>
        <View testID="result-first-screen" style={isSaved ? { minHeight: height - Math.max(40, insets.top) } : undefined}>
        <View style={[styles.header, isSaved && styles.savedHeader, { width: layout.contentWidth }]} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height + 5)}>
          <BackButton onPress={() => router.dismissTo('/')} />
          <Text accessibilityRole="header" allowFontScaling style={[styles.heading, isSaved && styles.savedHeading]}>{isSaved && kit ? kit.title : 'Your colors'}</Text>
        </View>
        {loading ? localPhoto ? <View style={{ minHeight: layout.heroHeight }}>
          <FilmPrint kit={{ photo: localPhoto, roles: emptyRoles(), colors: [] }} width={layout.printWidth} height={layout.printHeight}
            failed={false} onError={() => setDisplayedPhoto(null)} onPhotoDisplay={() => setDisplayedPhoto({ id, url: localPhoto.url })}
            showPins={false} onPinPress={() => {}} placeholder={null} />
          {photoVisible && <View style={{ marginTop: -72, paddingBottom: 24 }}><MunchPlayer key={id} width={munchWidth} active={focused} /></View>}
        </View> : <View style={ui.center}><Text style={ui.body}>Loading your photo…</Text></View> : error ? <View style={ui.center}>
          <Baku pose={error === 'notFound' ? 'notFound' : 'errorPhoto'} />
          <Text style={ui.message}>{error === 'notFound' ? 'This kit couldn’t be found.' : 'Couldn’t load this kit. Please try again.'}</Text>
          <ActionButton label="Try again" onPress={retry} />
        </View> : kit ? <>
          {isSaved ? <>
            <Text allowFontScaling accessibilityLabel={`Saved to ${collectionName}`} accessibilityLiveRegion="polite" style={[ui.body, styles.savedCopy]}>Saved to your collection.</Text>
            <View accessibilityLabel={kit.title}>
              <SavedKit kit={kit} failed={photoFailed} disabled={!sequence.interactive}
                maxHeight={height - Math.max(40, insets.top) - (headerHeight ?? 89) - 48 * fontScale - Math.max(108, actionHeight) - footerBottom - 40}
                onError={() => setFailedPhotoUrl(kit.photo!.url)} onEdit={() => setSheet({ kitId: id, type: 'edit' })}
                placeholder={<View style={styles.placeholder}><Baku pose={photoFailed ? 'errorPhoto' : 'empty'} />
                  <Text style={ui.message}>{photoFailed ? 'Couldn’t load the photo.' : 'No photo in this kit.'}</Text>
                  {photoFailed && <ActionButton label="Reload photo" onPress={() => { setFailedPhotoUrl(null); retry(); }} />}
                </View>} />
            </View>
          </> : <View testID="result-hero" accessibilityLabel={kit.title} style={{ width: heroWidth, alignSelf: 'center', minHeight: layout.heroHeight }}>
            <FilmPrint kit={kit} width={layout.printWidth} height={layout.printHeight} failed={photoFailed}
              preview={localPhoto?.url} onPhotoDisplay={() => setDisplayedPhoto({ id, url: kit.photo!.url })}
              onError={() => { setDisplayedPhoto(null); setFailedPhotoUrl(kit.photo!.url); }} selectedRole={editing ? selectedRole : null}
              markerStyle={sequence.markerStyle} onPinPress={openRole} interactive={sequence.interactive} placeholder={<View style={styles.placeholder}>
                <Baku pose={photoFailed ? 'errorPhoto' : 'empty'} roles={kit.roles} stripeProgress={sequence.stripeProgress} wipeMode={sequence.wipeMode} />
                <Text style={ui.message}>{photoFailed ? 'Couldn’t load the photo.' : 'No photo in this kit.'}</Text>
                {photoFailed && <ActionButton label="Reload photo" onPress={() => { setFailedPhotoUrl(null); retry(); }} />}
              </View>} />
            {!ready && photoVisible && <View style={{ marginTop: -72, paddingBottom: 24 }}>
              <MunchPlayer key={id} width={munchWidth} active={focused} />
            </View>}
            {ready && <View style={{ marginTop: -113, marginHorizontal: 20 }}>
              <ChipPile roles={kit.roles} slots={layout.slots} height={layout.pileHeight} typeSize={layout.typeSize}
                expandedRole={detail?.kitId === id ? detail.role : null} motion={sequence.bands} disabled={!sequence.interactive} selectedRole={editing ? selectedRole : null}
                onPress={(role) => {
                  if (!kit.roles[role]) openRole(role);
                  else setDetail((current) => {
                    const next = toggleChip(current?.kitId === id ? current.role : null, role);
                    return next ? { kitId: id, role: next, scrollY: scrollY.current } : null;
                  });
                }} />
            </View>}
            {ready && primaryPin && <PrimaryArrow width={heroWidth} height={layout.heroHeight}
              start={{ x: 20 + layout.slots[0].x + 12, y: layout.printHeight - 113 + layout.slots[0].height * 0.25 }}
              end={{ x: printLeft + 13 + primaryPin.marker.x, y: 13 + primaryPin.marker.y }}
              hue={primaryHue(kit)} progress={sequence.values.markerOpacity} reducedMotion={sequence.reducedMotion} />}
          </View>}
          {isSaved && <View testID="result-actions" style={styles.savedFooter}>
            <View style={styles.savedHost}>
              <CornerBaku size={64} focused={focused && sheet?.kitId !== id && detail?.kitId !== id}
                pose={hop.pose && hop.pose !== 'idle' ? hop.pose : 'success'} motionStyle={hop.bakuStyle} shadowStyle={hop.shadowStyle} />
            </View>
            <View style={styles.savedActions} onLayout={(event) => setActionHeight(Math.max(108, event.nativeEvent.layout.height))}>
              <ActionButton label="See your collection" primary disabled={!savedId}
                onPress={() => { if (savedId) router.push({ pathname: '/collection/[id]', params: { id: savedId } }); }} />
              <ActionButton label="Snap another" onPress={() => router.dismissTo('/')} />
            </View>
          </View>}
        </> : null}
        </View>
        {kit && <View style={[styles.brief, { width: layout.contentWidth, marginTop: isSaved ? 32 : ready ? 100 : 16 }]}>
          <BriefBlock brief={kit.brief} failed={briefFailed} showBaku={false} motionStyle={ready ? sequence.briefStyle : undefined} />
          {(briefFailed || kit.brief.status === 'failed') && <ActionButton label="Check brief again" onPress={retry} />}
        </View>}
      </ScrollView>
      {!isSaved && <View testID="result-actions" pointerEvents="box-none" style={[styles.footer, { bottom: footerBottom, maxWidth: 390 }]}>
        <Canvas accessible={false} pointerEvents="none" style={StyleSheet.flatten([styles.fade, { height: actionHeight + footerBottom + 20 }])}>
          <Rect x={0} y={0} width={Math.min(width, 390)} height={actionHeight + footerBottom + 20}>
            <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: 40 }} colors={['#F3EEE400', PAPER]} />
          </Rect>
        </Canvas>
        {photoVisible && (loading || (!!kit && !ready)) && <ChewingCaption key={id}
          style={{ position: 'absolute', left: 82, right: 16, bottom: actionHeight + 16 }} />}
        {ready && <View style={styles.host}>
          <CornerBaku size={62} focused={focused && sheet?.kitId !== id && detail?.kitId !== id} pose={hop.pose && hop.pose !== 'idle' ? hop.pose : failedBrief ? 'errorBrief' : 'idle'}
            motionStyle={hop.bakuStyle} shadowStyle={hop.shadowStyle} />
        </View>}
        {ready && <View style={styles.actions} onLayout={(event) => setActionHeight(Math.max(48, event.nativeEvent.layout.height))}>
          <View style={styles.edit}><ActionButton label="Edit" disabled={!sequence.interactive} onPress={() => setSheet({ kitId: id, type: 'edit' })} /></View>
          <View style={styles.save}><ActionButton label="Save" primary disabled={!sequence.interactive}
            onPress={() => router.push({ pathname: '/keep/[id]', params: { id } })} /></View>
        </View>}
      </View>}
      {kit && <>
        {detail?.kitId === id && kit.roles[detail.role] && <ChipDetail key={`${id}-${detail.role}`} kit={kit} role={detail.role}
          slot={layout.slots.find((slot) => slot.role === detail.role)!}
          origin={{ x: (width - heroWidth) / 2 + 20 + layout.slots.find((slot) => slot.role === detail.role)!.x,
            y: layout.pileTop + layout.slots.find((slot) => slot.role === detail.role)!.y - detail.scrollY }}
          onClose={() => setDetail(null)} onEdit={() => { const role = detail.role; setDetail(null); openRole(role); }} />}
        <EditSheet ref={editSheet} visible={sheet?.kitId === id && sheet.type === 'edit'} kit={kit}
          initialRole={sheet?.kitId === id && sheet.type === 'edit' ? sheet.role : undefined} onSelectedRole={setSelectedRole}
          onUpdated={replaceKit} onClose={() => { setSelectedRole(null); setSheet((current) => current?.kitId === id && current.type === 'edit' ? null : current); }} />
      </>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { alignSelf: 'center', gap: 5, marginBottom: 5 },
  heading: { ...ui.heading, fontSize: 30, lineHeight: 32 },
  savedHeader: { gap: 9, marginBottom: 0 },
  savedHeading: { maxWidth: 310, fontSize: 31, lineHeight: 31 },
  savedCopy: { marginTop: 10, marginBottom: 18, marginHorizontal: 20, fontSize: 14, lineHeight: 20 },
  savedFooter: { marginTop: 24, marginHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  savedHost: { width: 64, marginBottom: 4 },
  savedActions: { flex: 1, gap: 12 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brief: { alignSelf: 'center', gap: 16 },
  footer: { position: 'absolute', left: 0, right: 0, width: '100%', alignSelf: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, top: -20 },
  host: { position: 'absolute', left: 16, bottom: -8 },
  actions: { marginLeft: 82, marginRight: 16, flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  edit: { width: 96 },
  save: { flex: 1 },
});
