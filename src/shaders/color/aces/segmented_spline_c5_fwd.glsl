precision mediump float;

#pragma glslify: M = require('~/src/shaders/color/aces/monomial')
#pragma glslify: log10 = require('~/src/shaders/color/aces/log10')
#pragma glslify: EPSILON = require('~/src/shaders/epsilon')

float segmented_spline_c5_fwd(float x) {
    float coefsLow[6]; // coefs for B-spline between minPoint and midPoint (units of log luminance)
    coefsLow[0] = -4.0000000000;
    coefsLow[1] = -4.0000000000;
    coefsLow[2] = -3.1573765773;
    coefsLow[3] = -0.4852499958;
    coefsLow[4] = 1.8477324706;
    coefsLow[5] = 1.8477324706;

    float coefsHigh[6]; // coefs for B-spline between midPoint and maxPoint (units of log luminance)
    coefsHigh[0] = -0.7185482425;
    coefsHigh[1] =  2.0810307172;
    coefsHigh[2] =  3.6681241237;
    coefsHigh[3] =  4.0000000000;
    coefsHigh[4] =  4.0000000000;
    coefsHigh[5] =  4.0000000000;

    vec2 minPoint = vec2(0.18*pow(2.,-15.0), 0.0001); // {luminance, luminance} linear extension below this
    vec2 midPoint = vec2(0.18,                4.8); // {luminance, luminance} 
    vec2 maxPoint = vec2(0.18*pow(2., 18.0), 10000.); // {luminance, luminance} linear extension above this
    float slopeLow = 0.0;       // log-log slope of low linear extension // TODO: some things are multiplied by this; simplify
    float slopeHigh = 0.0;      // log-log slope of high linear extension

    const int N_KNOTS_LOW = 4;
    const int N_KNOTS_HIGH = 4;

    // Check for negatives or zero before taking the log. If negative or zero,
    // set to the smallest positive float (EPSILON).
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
            cf = vec3(coefsLow[4],  coefsLow[5],  0.0        );
        } else if ( j == 5) {
            cf = vec3(coefsLow[5],  0.0,          0.0        );
        } else if ( j == 6) {
            cf = vec3(0.0,          0.0,          0.0        );
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);

    } else if (( logx >= log10(midPoint.x) ) && ( logx < log10(maxPoint.x) )) {

        float knot_coord = float(N_KNOTS_HIGH-1) * (logx-log10(midPoint.x))/(log10(maxPoint.x)-log10(midPoint.x));
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec3 cf;
        if ( j <= 0) {
            cf = vec3(coefsHigh[0],  coefsHigh[1],  coefsHigh[2]);
        } else if ( j == 1) {
            cf = vec3(coefsHigh[1],  coefsHigh[2],  coefsHigh[3]);
        } else if ( j == 2) {
            cf = vec3(coefsHigh[2],  coefsHigh[3],  coefsHigh[4]);
        } else if ( j == 3) {
            cf = vec3(coefsHigh[3],  coefsHigh[4],  coefsHigh[5]);
        } else if ( j == 4) {
            cf = vec3(coefsHigh[4],  coefsHigh[5],  0.0         );
        } else if ( j == 5) {
            cf = vec3(coefsHigh[5],  0.0,           0.0         );
        } else if ( j == 6) {
            cf = vec3(0.0,           0.0,           0.0         );
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);

    } else { //if ( logIn >= log10(maxPoint.x) ) { 

        logy = logx * slopeHigh + ( log10(maxPoint.y) - slopeHigh * log10(maxPoint.x) );

    }

    return pow(logy, 10.0);
}

#pragma glslify: export(segmented_spline_c5_fwd)