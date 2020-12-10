/*
# License Terms for Academy Color Encoding System Components #
https://github.com/ampas/aces-dev/blob/v1.0/LICENSE.md

Academy Color Encoding System (ACES) software and tools are provided by the
Academy under the following terms and conditions: A worldwide, royalty-free,
non-exclusive right to copy, modify, create derivatives, and use, in source and
binary forms, is hereby granted, subject to acceptance of this license.

Copyright (c) 2013 Academy of Motion Picture Arts and Sciences (A.M.P.A.S.).
Portions contributed by others as indicated. All rights reserved.

Performance of any of the aforementioned acts indicates acceptance to be bound
by the following terms and conditions:

* Copies of source code, in whole or in part, must retain the above copyright
notice, this list of conditions and the Disclaimer of Warranty.

* Use in binary form must retain the above copyright notice, this list of
conditions and the Disclaimer of Warranty in the documentation and/or other
materials provided with the distribution.

* Nothing in this license shall be deemed to grant any rights to trademarks,
copyrights, patents, trade secrets or any other intellectual property of
A.M.P.A.S. or any contributors, except as expressly stated herein.

* Neither the name "A.M.P.A.S." nor the name of any other contributors to this
software may be used to endorse or promote products derivative of or based on
this software without express prior written permission of A.M.P.A.S. or the
contributors, as appropriate.

This license shall be construed pursuant to the laws of the State of
California, and any disputes related thereto shall be subject to the
jurisdiction of the courts therein.

Disclaimer of Warranty: THIS SOFTWARE IS PROVIDED BY A.M.P.A.S. AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT ARE DISCLAIMED. IN NO EVENT SHALL A.M.P.A.S., OR ANY
CONTRIBUTORS OR DISTRIBUTORS, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, RESITUTIONARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE ACADEMY SPECIFICALLY
DISCLAIMS ANY REPRESENTATIONS OR WARRANTIES WHATSOEVER RELATED TO PATENT OR
OTHER INTELLECTUAL PROPERTY RIGHTS IN THE ACADEMY COLOR ENCODING SYSTEM, OR
APPLICATIONS THEREOF, HELD BY PARTIES OTHER THAN A.M.P.A.S.,WHETHER DISCLOSED OR
UNDISCLOSED.
*/

precision mediump float;

#pragma glslify: log10 = require('~/src/shaders/color/aces/log10')
#pragma glslify: segmented_spline_c5_fwd = require('~/src/shaders/color/aces/segmented_spline_c5_fwd')
#pragma glslify: EPSILON = require('~/src/shaders/epsilon')
#pragma glslify: M = require('~/src/shaders/color/aces/monomial')

#pragma glslify: AP1_2_XYZ_MAT = require('~/src/shaders/color/aces/ap1_2_xyz_mat')
#pragma glslify: AP1_2_AP0_MAT = require('~/src/shaders/color/aces/ap1_2_ap0_mat')
#pragma glslify: AP0_2_AP1_MAT = require('~/src/shaders/color/aces/ap0_2_ap1_mat')
#pragma glslify: AP1_RGB2Y = require('~/src/shaders/color/aces/ap1_rgb2y')

#define PI 3.1415926538

// "Glow" module constants
const float RRT_GLOW_GAIN = 0.05;
const float RRT_GLOW_MID = 0.08;

// Red modifier constants
const float RRT_RED_SCALE = 0.82;
const float RRT_RED_PIVOT = 0.03;
const float RRT_RED_HUE = 0.0;
const float RRT_RED_WIDTH = 135.0;

// Desaturation contants
const float RRT_SAT_FACTOR = 0.96;
const mat3 RRT_SAT_MAT = mat3(
    vec3((1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[0] + RRT_SAT_FACTOR, (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[1], (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[2]),
    vec3((1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[0], (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[1] + RRT_SAT_FACTOR, (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[2]),
    vec3((1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[0], (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[1], (1.0 - RRT_SAT_FACTOR) * AP1_RGB2Y[2] + RRT_SAT_FACTOR)
);

float rgb_2_saturation(vec3 rgb) {
    float max_rgb = max(rgb.r, max(rgb.g, rgb.b));
    float min_rgb = min(rgb.r, min(rgb.g, rgb.b));
    return (max(max_rgb, 1e-10) - max(min_rgb, 1e-10)) / max(max_rgb, 1e-2);
}

float rgb_2_yc(vec3 rgb, float ycRadiusWeight /* this defaults to 1.75 */)
{
  // Converts RGB to a luminance proxy, here called YC
  // YC is ~ Y + K * Chroma
  // Constant YC is a cone-shaped surface in RGB space, with the tip on the 
  // neutral axis, towards white.
  // YC is normalized: RGB 1 1 1 maps to YC = 1
  //
  // ycRadiusWeight defaults to 1.75, although can be overridden in function 
  // call to rgb_2_yc
  // ycRadiusWeight = 1 -> YC for pure cyan, magenta, yellow == YC for neutral 
  // of same value
  // ycRadiusWeight = 2 -> YC for pure red, green, blue  == YC for  neutral of 
  // same value.

  float r = rgb.r; 
  float g = rgb.g; 
  float b = rgb.b;
  
  float chroma = sqrt(b*(b-g)+g*(g-r)+r*(r-b));

  return ( b + g + r + ycRadiusWeight * chroma) / 3.;
}

float sigmoid_shaper(float x)
{
    // Sigmoid function in the range 0 to 1 spanning -2 to +2.

    float t = max(1. - abs( x / 2.), 0.);
    float y = 1. + sign(x) * (1. - t * t);

    return y / 2.;
}

float glow_fwd(float ycIn, float glowGainIn, float glowMid) {
    float glowGainOut;

    // TODO: rewrite as branchless
    if (ycIn <= 2.0/3.0 * glowMid) {
        glowGainOut = glowGainIn;
    } else if (ycIn >= 2.0 * glowMid) {
        glowGainOut = 0.0;
    } else {
        glowGainOut = glowGainIn * (glowMid / ycIn - 1.0 / 2.0);
    }

    return glowGainOut;
}

float rgb_2_hue(vec3 rgb) {
    float hue;

    if (rgb.r == rgb.g && rgb.g == rgb.b) {
        hue = 0.0; // RGB triplets where RGB are equal have an undefined hue
    } else {
        hue = (180.0 / PI) * atan(sqrt(3.0) * (rgb.g - rgb.b), 2.0 * rgb.r - rgb.g - rgb.b); // TODO: hard code sqrt_3 or use optimizer
    }

    if (hue < 0.0) {
        hue = hue + 360.0;
    }

    return hue;
}

float center_hue(float hue, float centerH) {
    float hueCentered = hue - centerH;
    if (hueCentered < -180.0) {
        hueCentered = hueCentered + 360.0;
    } else if (hueCentered > 180.0) {
        hueCentered = hueCentered - 360.0;
    }
    return hueCentered;
}

const mat4 cubic_basis_m = mat4( // row major since these are looked up directly atm
    vec4( -1./6.0,  3./6.0, -3./6.0,  1./6.0 ),
    vec4(  3./6.0, -6./6.0,  3./6.0,  0./6.0 ),
    vec4( -3./6.0,  0./6.0,  3./6.0,  0./6.0 ),
    vec4(  1./6.0,  4./6.0,  1./6.0,  0./6.0 )
);

float cubic_basis_shaper(float x, float w) {
    float knots[5];
    knots[0] = -w / 2.0;
    knots[1] = -w / 4.0;
    knots[2] = 0.0;
    knots[3] = w / 4.0;
    knots[4] = w / 2.0;

    float y = 0.0;

    if ((x > knots[0]) && (x < knots[4])) { // TODO: branchless
            
        float knot_coord = (x - knots[0]) * 4./w;  
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec4 monomials = vec4(t * t * t, t * t, t, 1.0);

        if (j == 3) { // TODO: matrix multiplication
            y = monomials.x * cubic_basis_m[0].x + monomials.y * cubic_basis_m[1].x + monomials.z * cubic_basis_m[2].x + monomials.w * cubic_basis_m[3].x;
        } else if ( j == 2) {
            y = monomials.x * cubic_basis_m[0].y + monomials.y * cubic_basis_m[1].y + monomials.z * cubic_basis_m[2].y + monomials.w * cubic_basis_m[3].y;
        } else if ( j == 1) {
            y = monomials.x * cubic_basis_m[0].z + monomials.y * cubic_basis_m[1].z + monomials.z * cubic_basis_m[2].z + monomials.w * cubic_basis_m[3].z;
        } else if ( j == 0) {
            y = monomials.x * cubic_basis_m[0].w + monomials.y * cubic_basis_m[1].w + monomials.z * cubic_basis_m[2].w + monomials.w * cubic_basis_m[3].w;
        } else {
            y = 0.0;
        }
    }
  
    return y * 3.0 / 2.0;
}

// Reference Rendering Transform (RRT)
//
// Input is ACES
// Output is OCES
vec3 RRT(vec3 aces) {
    // --- Glow module --- //
    float saturation = rgb_2_saturation(aces);
    float ycIn = rgb_2_yc(aces, 1.75);
    float s = sigmoid_shaper((saturation - 0.4) / 0.2); // TODO: smoothstep is sigmoid; probably an easy replacement
    float addedGlow = 1.0 + glow_fwd(ycIn, RRT_GLOW_GAIN * s, RRT_GLOW_MID);

    aces = aces * addedGlow;

    // --- Red modifier --- //
    float hue = rgb_2_hue(aces);
    float centeredHue = center_hue(hue, RRT_RED_HUE); // TODO: this seems to be a no-op?
    float hueWeight = cubic_basis_shaper(centeredHue, RRT_RED_WIDTH);

    aces.r = aces.r + hueWeight * saturation * (RRT_RED_PIVOT - aces.r) * (1.0 - RRT_RED_SCALE);

    // --- ACES to RGB rendering space --- //
    aces = max(aces, 0.0); // avoids saturated negative colors from becoming positive in the matrix

    vec3 rgbPre = AP0_2_AP1_MAT * aces;

    rgbPre = max(rgbPre, 0.0);

    // --- Global desaturation --- //
    rgbPre = RRT_SAT_MAT * rgbPre;

    // --- Apply the tonescale independently in rendering-space RGB --- //
    vec3 rgbPost = vec3(
        segmented_spline_c5_fwd(rgbPre.r),
        segmented_spline_c5_fwd(rgbPre.g),
        segmented_spline_c5_fwd(rgbPre.b)
    );

    // --- RGB rendering space to OCES --- //
    vec3 rgbOces = AP1_2_AP0_MAT * rgbPost;

    return rgbOces;
}

float segmented_spline_c9_fwd(float x) {
    float coefsLow[10];    // coefs for B-spline between minPoint and midPoint (units of log luminance)
    coefsLow[0] = -1.6989700043;
    coefsLow[1] = -1.6989700043;
    coefsLow[2] = -1.4779000000;
    coefsLow[3] = -1.2291000000;
    coefsLow[4] = -0.8648000000;
    coefsLow[5] = -0.4480000000;
    coefsLow[6] =  0.0051800000;
    coefsLow[7] =  0.4511080334;
    coefsLow[8] =  0.9113744414;
    coefsLow[9] =  0.9113744414;

    float coefsHigh[10];   // coefs for B-spline between midPoint and maxPoint (units of log luminance)
    coefsHigh[0] = 0.5154386965;
    coefsHigh[1] = 0.8470437783;
    coefsHigh[2] = 1.1358000000;
    coefsHigh[3] = 1.3802000000;
    coefsHigh[4] = 1.5197000000;
    coefsHigh[5] = 1.5985000000;
    coefsHigh[6] = 1.6467000000;
    coefsHigh[7] = 1.6746091357;
    coefsHigh[8] = 1.6878733390;
    coefsHigh[9] = 1.6878733390;

    vec2 minPoint = vec2(segmented_spline_c5_fwd( 0.18*pow(2.,-6.5) ),  0.02); // {luminance, luminance} linear extension below this
    vec2 midPoint = vec2(segmented_spline_c5_fwd( 0.18 ),                4.8); // {luminance, luminance} 
    vec2 maxPoint = vec2(segmented_spline_c5_fwd( 0.18*pow(2.,6.5) ),   48.0); // {luminance, luminance} linear extension above this
    float slopeLow  = 0.0;       // log-log slope of low linear extension
    float slopeHigh = 0.04;      // log-log slope of high linear extension

    const int N_KNOTS_LOW = 8;
    const int N_KNOTS_HIGH = 8;

    // Check for negatives or zero before taking the log. If negative or zero,
    // set to EPSILON.
    float logx = log10(max(x, EPSILON)); 

    float logy;

    if ( logx <= log10(minPoint.x) ) { 
        logy = logx * slopeLow + ( log10(minPoint.y) - slopeLow * log10(minPoint.x) );
    } else if (( logx > log10(minPoint.x) ) && ( logx < log10(midPoint.x) )) {
        float knot_coord = float(N_KNOTS_LOW-1) * (logx-log10(minPoint.x))/(log10(midPoint.x)-log10(minPoint.x));
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec3 cf;
        if ( j <= 0) {
            cf = vec3(coefsLow[0],  coefsLow[1],  coefsLow[2]);
        } else if ( j == 1) {
            cf = vec3(coefsLow[1],  coefsLow[2],  coefsLow[3]);
        } else if ( j == 2) {
            cf = vec3(coefsLow[2],  coefsLow[3],  coefsLow[4]);
        } else if ( j == 3) {
            cf = vec3(coefsLow[3],  coefsLow[4],  coefsLow[5]);
        } else if ( j == 4) {
            cf = vec3(coefsLow[4],  coefsLow[5],  coefsLow[6]);
        } else if ( j == 5) {
            cf = vec3(coefsLow[5],  coefsLow[6],  coefsLow[7]);
        } else if ( j == 6) {
            cf = vec3(coefsLow[6],  coefsLow[7],  coefsLow[8]);
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);
    } else if (( logx >= log10(midPoint.x) ) && ( logx < log10(maxPoint.x) )) {

        float knot_coord = float(N_KNOTS_HIGH-1) * (logx-log10(midPoint.x))/(log10(maxPoint.x)-log10(midPoint.x));
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec3 cf;
        if ( j <= 0) {
            cf = vec3(coefsHigh[0], coefsHigh[1], coefsHigh[2]);
        } else if ( j == 1) {
            cf = vec3(coefsHigh[1], coefsHigh[2], coefsHigh[3]);
        } else if ( j == 2) {
            cf = vec3(coefsHigh[2], coefsHigh[3], coefsHigh[4]);
        } else if ( j == 3) {
            cf = vec3(coefsHigh[3], coefsHigh[4], coefsHigh[5]);
        } else if ( j == 4) {
            cf = vec3(coefsHigh[4], coefsHigh[5], coefsHigh[6]);
        } else if ( j == 5) {
            cf = vec3(coefsHigh[5], coefsHigh[6], coefsHigh[7]);
        } else if ( j == 6) {
            cf = vec3(coefsHigh[6], coefsHigh[7], coefsHigh[8]);
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);
    } else { //if ( logIn >= log10(maxPoint.x) ) { 
        logy = logx * slopeHigh + ( log10(maxPoint.y) - slopeHigh * log10(maxPoint.x) );
    }

    return pow(logy, 10.0);
}

#pragma glslify: export(RRT)