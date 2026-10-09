import { Redirect } from 'expo-router';
import { munchLabEnabled } from '@/munch/enabled';
import { MunchLab } from '@/munch/MunchLab';

export default function MunchLabScreen() {
  return munchLabEnabled ? <MunchLab /> : <Redirect href="/" />;
}
