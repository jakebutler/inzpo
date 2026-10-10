export const KNIT_SHADER = `
uniform shader neutral; uniform shader cheeks; uniform shader squeeze; uniform shader pleased; uniform shader material;
uniform float fullness; uniform float closed; uniform float happy; uniform float coatFill;
uniform float4 palette[6];
float ellipse(float2 uv, float2 center, float2 radius) { return 1.0-smoothstep(.70,1.0,length((uv-center)/radius)); }
half4 main(float2 uv) {
  half4 base=neutral.eval(uv);
  float cheekMask=max(ellipse(uv,float2(.441,.645),float2(.145,.16)),ellipse(uv,float2(.183,.548),float2(.068,.13)));
  base=mix(base,cheeks.eval(uv),cheekMask*fullness);
  float eyeMask=max(ellipse(uv,float2(.421,.455),float2(.065,.106)),ellipse(uv,float2(.23,.427),float2(.035,.084)));
  base=mix(base,squeeze.eval(uv),eyeMask*closed);
  base=mix(base,pleased.eval(uv),eyeMask*happy);
  float3 coat=material.eval(uv).rgb;
  float panel=floor(min(coat.b,.999)*6.0);
  float4 dye=palette[0];
  for(int i=1;i<6;i++){ dye=mix(dye,palette[i],step(float(i),panel)); }
  float travel=(panel/5.0)*.30+clamp((uv.x-.58)/.30,0.0,1.0)*.25;
  float reveal=smoothstep(travel,travel+.40,coatFill)*dye.a;
  float3 wool=mix(float3(.61),dye.rgb,reveal)*(coat.g/.72);
  base.rgb=mix(base.rgb,clamp(wool,0.0,1.0)*base.a,coat.r);
  return base;
}`;
