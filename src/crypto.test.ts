import { describe, it, expect } from 'vitest';
import { Crypto, generatePrivateKey, deriveId, sign, _internal } from './crypto';

const { jacobianAdd, jacobianDouble, fastMultiply } = _internal;

describe('Crypto', () => {
  describe('generatePrivateKey', () => {
    it('should generate a 64-character hex private key', () => {
      const crypto = new Crypto();
      const prvkey = crypto.generatePrivateKey();
      expect(prvkey).toHaveLength(64);
      // Verify it's valid hex
      expect(/^[0-9a-f]{64}$/.test(prvkey)).toBe(true);
    });

    it('should generate unique keys', () => {
      const crypto = new Crypto();
      const key1 = crypto.generatePrivateKey();
      const key2 = crypto.generatePrivateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('deriveId', () => {
    it('should derive correct ID from private key', () => {
      const crypto = new Crypto();
      const id = crypto.id('6d2fb6f546bacfd98c68769e61e0b44a697a30596c018a50e28200aa59b01c0a');
      expect(id).toBe('4fef2b5a82d134d058c1883c72d6d9caf77cd59ca82d73105017590dea3dcb87');
    });
  });

  describe('jacobianAdd', () => {
    it('should correctly add two Jacobian points', () => {
      const p1 = 9145974245324100229099870468775465651310464820817378424695723232290407343942n;
      const p2 = 5726454693002325744504615879224937090641195997533856518133185097441749801032n;
      const p3 = 115714549703150523321131187169862203539915631312738481595605540015431713717331n;
      const p: [bigint, bigint, bigint] = [p1, p2, p3];

      const q1 = 3378859141843082240981311929530924778908494294056496383285600481501351521548n;
      const q2 = 27521306930728475164406447156615413460758360212583572363332152141481614403438n;
      const q3 = 49323301439068515073562494645799725679211443313890051705798536862743810731758n;
      const q: [bigint, bigint, bigint] = [q1, q2, q3];

      const r = jacobianAdd(p, q);

      expect(r[0]).toBe(3839523019051154503084769099381507415584753837414379863264960425500703565923n);
      expect(r[1]).toBe(20189644703747003499840421980750524561734367487063517298774288662171391490014n);
      expect(r[2]).toBe(60937054099961058364101483468792603644143119999146283853926532658309628838553n);
    });
  });

  describe('jacobianDouble', () => {
    it('should correctly double a Jacobian point', () => {
      const p1 = 9145974245324100229099870468775465651310464820817378424695723232290407343942n;
      const p2 = 5726454693002325744504615879224937090641195997533856518133185097441749801032n;
      const p3 = 115714549703150523321131187169862203539915631312738481595605540015431713717331n;
      const p: [bigint, bigint, bigint] = [p1, p2, p3];

      const r = jacobianDouble(p);

      expect(r[0]).toBe(47799865997534219673197337605336645889814818209350362461488238402445197905424n);
      expect(r[1]).toBe(60263407694755846743636806277114588321762727181244820843669538143699156517749n);
      expect(r[2]).toBe(98392693047863901823354926635876248059211737341107593029860323683906341241571n);
    });
  });

  describe('fastMultiply', () => {
    it('should correctly multiply a point by a scalar', () => {
      const p1 = 9145974245324100229099870468775465651310464820817378424695723232290407343942n;
      const p2 = 5726454693002325744504615879224937090641195997533856518133185097441749801032n;
      const p: [bigint, bigint] = [p1, p2];
      const n = 49323301439068515073562494645799725679211443313890051705798536862743810731758n;

      const r = fastMultiply(p, n);

      expect(r[0]).toBe(55168891259068323847970500732782990269643885682720201005538882429359294222592n);
      expect(r[1]).toBe(24653118739118393505255051840680624663656725984701285210882487021736401159116n);
    });
  });

  describe('sign', () => {
    it('should produce correct signature', () => {
      const crypto = new Crypto();
      const prvkey = 'd6eb959e9aec2e6fdc44b5862b269e987b8a4d6f2baca542d8acaa97ee5e74f6';
      const expectedSignature = 'e713a1bb015fecabb5a084b0fe6d6e7271fca6f79525a634183cfdb175fe69241f4da161779d8e6b761200e1cf93766010a19072fa778f9643363e2cfadd640900';
      const data = 'hello';

      const sig = crypto.sign(data, prvkey);

      expect(sig).toHaveLength(130);
      expect(sig).toBe(expectedSignature);
    });

    it('should produce 130-character hex signatures', () => {
      const crypto = new Crypto();
      const prvkey = crypto.generatePrivateKey();
      const sig = crypto.sign('test message', prvkey);

      expect(sig).toHaveLength(130);
      expect(/^[0-9a-f]{130}$/.test(sig)).toBe(true);
    });
  });
});
