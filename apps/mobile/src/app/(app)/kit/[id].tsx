import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { Baku } from '@/components/Baku';
import { BriefBlock } from '@/components/BriefBlock';
import { RoleBands } from '@/components/RoleBands';
import { SaveSheetContent } from '@/components/SaveSheetContent';
import { useKit } from '@/lib/use-kit';
import { ui } from '@/theme/styles';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { kit, loading, error, briefFailed, retry } = useKit(id);
  const [showSave, setShowSave] = useState(false);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photoFailed = !!kit?.photo && kit.photo.url === failedPhotoUrl;
  const { height } = useWindowDimensions();

  return (
    <SafeAreaView style={ui.screen} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[ui.content, !kit && { flexGrow: 1 }]}>
        {loading ? (
          <View style={ui.center}>
            <Baku pose="chewing" />
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
                <Baku pose={photoFailed ? 'errorPhoto' : 'empty'} />
                <Text style={ui.message}>{photoFailed ? 'Couldn’t load the photo.' : 'No photo in this kit.'}</Text>
                {photoFailed && <ActionButton label="Reload photo" onPress={() => { setFailedPhotoUrl(null); retry(); }} />}
              </View>
            )}
            <RoleBands roles={kit.roles} />
            <BriefBlock brief={kit.brief} failed={briefFailed} />
            {(briefFailed || kit.brief.status === 'failed') && <ActionButton label="Check brief again" onPress={retry} />}
          </>
        ) : null}
        <ActionButton label="Save" primary disabled={!kit} onPress={() => setShowSave(true)} />
      </ScrollView>
      <Modal visible={showSave && !!kit} presentationStyle="pageSheet" onRequestClose={() => setShowSave(false)}>
        {showSave && kit && <SaveSheetContent kitId={kit.id} onClose={() => setShowSave(false)} />}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 16 },
});
