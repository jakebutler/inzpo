import type { MobileKit, ColorRole } from '@inzpo/shared';
import { Canvas, Circle, RadialGradient } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { PaintChip } from './PaintChip';
import { OATMEAL_STOCK } from '@/theme/materials';

const order: readonly ColorRole[] = ['text', 'surface', 'background', 'accent', 'secondary', 'primary'];

function Rivet({ size }: { size: number }) {
  return <View accessible={false} style={[styles.rivet, { width: size, height: size, borderRadius: size / 2 }]}>
    <Canvas style={StyleSheet.absoluteFill} accessible={false} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1}>
        <RadialGradient c={{ x: size * 0.28, y: size * 0.24 }} r={size * 0.85}
          colors={['#FFF7D5', '#EBD091', '#B58B3E', '#725019']} positions={[0, 0.15, 0.56, 1]} />
      </Circle>
      <Circle cx={size / 2} cy={size / 2} r={size * 0.17}>
        <RadialGradient c={{ x: size * 0.44, y: size * 0.43 }} r={size * 0.28} colors={['#ECD89C', '#80601F']} />
      </Circle>
    </Canvas>
  </View>;
}

/** Six pieces of stock, including empty roles, share the physical corner pivot. */
export function KitDeck({ kit, closed = false, typeSize = 11 }: { kit: MobileKit; closed?: boolean; typeSize?: number }) {
  return <View testID={closed ? 'closed-kit-deck' : 'keep-kit-fan'} accessible={false}
    style={closed ? styles.closed : styles.fan}>
    {order.map((role, index) => <View key={role} style={closed ? {
      position: 'absolute', left: 18 + index * 4, top: (5 - index) * 1.5, zIndex: index,
      transformOrigin: '12px 154px', transform: [{ rotate: '-3deg' }],
    } : {
      position: 'absolute', left: 112, top: 80, zIndex: index,
      transformOrigin: '12px 170px', transform: [{ rotate: `${-30 + index * 12}deg` }],
    }}>
      <PaintChip role={role} color={kit.roles[role]} width={closed ? 124 : 120} height={closed ? 168 : 184}
        typeSize={typeSize} deck labelInset={closed ? 29 : 36} />
      {closed && index < order.length - 1 && <View testID={`deck-edge-${role}`} pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 2, width: 3, height: 168 * 0.62,
          backgroundColor: kit.roles[role] ?? OATMEAL_STOCK }} />}
    </View>)}
    <View style={closed ? styles.closedRivet : styles.fanRivet}><Rivet size={closed ? 23 : 17} /></View>
  </View>;
}

const styles = StyleSheet.create({
  fan: { width: 310, height: 410, alignSelf: 'center', marginTop: 22,
    transformOrigin: '50% 40%', transform: [{ translateX: -6 }, { scale: 1.34 }] },
  closed: { width: 150, height: 210, transformOrigin: 'top left', transform: [{ scale: 1.18 }] },
  fanRivet: { position: 'absolute', left: 115, top: 247, zIndex: 20 },
  closedRivet: { position: 'absolute', left: 33, top: 135, zIndex: 20 },
  rivet: { borderWidth: 1, borderColor: '#694716', backgroundColor: '#B58B3E',
    boxShadow: [{ offsetX: 1, offsetY: 2, blurRadius: 2, color: '#1C1B1970' }] },
});
